FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required by OpenCV and MediaPipe
RUN apt-get update && apt-get install -y --no-install-recommends     libgl1     libglib2.0-0     libsm6     libxext6     libxrender1     && rm -rf /var/lib/apt/lists/*

# Install CPU PyTorch first for smaller, faster container builds
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py run_cli.py ./
COPY veristream/ ./veristream/

# Create writable directories for Hugging Face non-root user
RUN mkdir -p /app/models /app/veristream_output && chmod -R 777 /app

ENV HF_HOME=/app/.cache/huggingface
ENV TORCH_HOME=/app/.cache/torch
ENV VS_MODELS=/app/models
ENV VS_OUT=/app/veristream_output

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
