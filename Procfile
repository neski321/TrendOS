web: ./start-production.sh
worker: sh -c 'echo "WORKER STARTING" && cd backend && pwd && ls -la venv/bin/ | head -5 && if [ -f venv/bin/python ]; then echo "Using venv/bin/python" && exec venv/bin/python service.py; elif [ -f venv/bin/python3 ]; then echo "Using venv/bin/python3" && exec venv/bin/python3 service.py; else echo "ERROR: No Python found in venv" && exit 1; fi'


