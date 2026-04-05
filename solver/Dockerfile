FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY solver/ ./solver/

ENTRYPOINT ["python", "solver/solver.py"]
CMD ["run"]
