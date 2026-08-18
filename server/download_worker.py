import sys
import os
import json
import time
import argparse
import urllib.request
import urllib.parse
import ssl

def format_speed(bytes_per_sec):
    if bytes_per_sec < 1024:
        return f"{bytes_per_sec:.1f} B/s"
    elif bytes_per_sec < 1024 * 1024:
        return f"{bytes_per_sec/1024:.1f} KB/s"
    else:
        return f"{bytes_per_sec/(1024*1024):.2f} MB/s"

def format_bytes(b):
    if b < 1024:
        return f"{b} B"
    elif b < 1024 * 1024:
        return f"{b/1024:.1f} KB"
    elif b < 1024 * 1024 * 1024:
        return f"{b/(1024*1024):.1f} MB"
    else:
        return f"{b/(1024*1024*1024):.2f} GB"

def emit_json(data):
    sys.stdout.write(json.dumps(data, ensure_ascii=False) + "\n")
    sys.stdout.flush()

def download_via_huggingface_hub(repo_id, filename, local_dir, endpoint, token=None):
    try:
        from huggingface_hub import hf_hub_download
        emit_json({"type": "info", "message": f"使用 huggingface_hub 从镜像 {endpoint} 下载..."})
        
        # 确保目录存在
        os.makedirs(local_dir, exist_ok=True)
        
        start_t = time.time()
        file_path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=local_dir,
            endpoint=endpoint,
            token=token if token else None
        )
        duration = time.time() - start_t
        emit_json({"type": "completed", "file_path": file_path, "duration": round(duration, 2)})
        return True
    except Exception as e:
        emit_json({"type": "error", "message": f"huggingface_hub 下载失败: {str(e)}"})
        return False

def download_stream(repo_id, filename, local_dir, endpoint, token=None):
    os.makedirs(local_dir, exist_ok=True)
    target_path = os.path.join(local_dir, filename)
    temp_path = target_path + ".downloading"

    base_endpoint = endpoint.rstrip('/')
    # URL 编码处理
    safe_filename = urllib.parse.quote(filename)
    url = f"{base_endpoint}/{repo_id}/resolve/main/{safe_filename}"
    
    emit_json({"type": "info", "message": f"正在发起请求: {url}"})

    headers = {
        "User-Agent": "LlamaManage-Downloader/1.0",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    downloaded_bytes = 0
    # 支持断点续传检查
    if os.path.exists(temp_path):
        downloaded_bytes = os.path.getsize(temp_path)
        if downloaded_bytes > 0:
            headers["Range"] = f"bytes={downloaded_bytes}-"
            emit_json({"type": "info", "message": f"发现未完成下载缓存，从 {format_bytes(downloaded_bytes)} 恢复断点续传..."})

    req = urllib.request.Request(url, headers=headers)

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as response:
            status_code = response.getcode()
            content_length = response.headers.get('Content-Length')
            
            total_bytes = None
            if content_length:
                if status_code == 206:
                    total_bytes = downloaded_bytes + int(content_length)
                else:
                    total_bytes = int(content_length)
                    downloaded_bytes = 0 # 服务器不支持断点续传，重头下载

            emit_json({
                "type": "start",
                "total_bytes": total_bytes,
                "total_formatted": format_bytes(total_bytes) if total_bytes else "未知",
                "resume": status_code == 206
            })

            mode = "ab" if (status_code == 206 and downloaded_bytes > 0) else "wb"
            with open(temp_path, mode) as f:
                chunk_size = 1024 * 1024 # 1MB chunk
                last_time = time.time()
                last_bytes = downloaded_bytes
                start_time = time.time()
                speed_str = "0 B/s"

                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded_bytes += len(chunk)

                    now = time.time()
                    if now - last_time >= 0.5:
                        speed = (downloaded_bytes - last_bytes) / (now - last_time)
                        speed_str = format_speed(speed)
                        percent = round((downloaded_bytes / total_bytes * 100), 2) if total_bytes else 0
                        
                        eta_seconds = 0
                        if total_bytes and speed > 0:
                            eta_seconds = int((total_bytes - downloaded_bytes) / speed)
                        
                        emit_json({
                            "type": "progress",
                            "downloaded": downloaded_bytes,
                            "downloaded_formatted": format_bytes(downloaded_bytes),
                            "total": total_bytes,
                            "total_formatted": format_bytes(total_bytes) if total_bytes else "未知",
                            "percent": percent,
                            "speed": speed_str,
                            "eta_seconds": eta_seconds
                        })
                        last_time = now
                        last_bytes = downloaded_bytes

        # 完成后重命名
        if os.path.exists(target_path):
            os.remove(target_path)
        os.rename(temp_path, target_path)

        duration = time.time() - start_time
        emit_json({
            "type": "completed",
            "file_path": target_path,
            "file_size": downloaded_bytes,
            "file_size_formatted": format_bytes(downloaded_bytes),
            "duration": round(duration, 2)
        })
        return True

    except Exception as e:
        emit_json({"type": "stream_error", "message": f"直接流式下载中断: {str(e)}，尝试切换 hf_hub_download 方案..."})
        return download_via_huggingface_hub(repo_id, filename, local_dir, endpoint, token)

def main():
    parser = argparse.ArgumentParser(description="HuggingFace GGUF Downloader")
    parser.add_argument("--repo_id", required=True, help="Hugging Face Repository ID (e.g., empero-ai/Qwen3.8-9B-GGUF)")
    parser.add_argument("--filename", required=True, help="GGUF Filename (e.g., Qwen3.8-9B-Q4_K_M.gguf)")
    parser.add_argument("--local_dir", required=True, help="Local directory to save the file")
    parser.add_argument("--endpoint", default="https://hf-mirror.com", help="Hugging Face endpoint/mirror")
    parser.add_argument("--token", default=None, help="Hugging Face Token (optional)")

    args = parser.parse_args()

    emit_json({
        "type": "init",
        "repo_id": args.repo_id,
        "filename": args.filename,
        "local_dir": args.local_dir,
        "endpoint": args.endpoint
    })

    success = download_stream(args.repo_id, args.filename, args.local_dir, args.endpoint, args.token)
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
