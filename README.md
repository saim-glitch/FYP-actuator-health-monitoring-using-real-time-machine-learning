python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload


Invoke-RestMethod -Uri http://localhost:8000/mission/takeoff_land -Method Post