web: ./start-production.sh
worker: cd backend && if [ -f venv/bin/python ]; then exec venv/bin/python service.py; elif [ -f venv/bin/python3 ]; then exec venv/bin/python3 service.py; else echo "ERROR: Python not found in venv" && exit 1; fi


