FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ENV U2NET_HOME=/root/.u2net
RUN python -c "from rembg import new_session; new_session('u2netp')"

COPY app ./app
COPY migrate_add_outfit_image.py .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]