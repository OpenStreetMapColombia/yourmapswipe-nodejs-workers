#!/bin/bash
rm -rf results.json
wget -q https://YOUR-DOMAIN.firebaseio.com/results.json
nohup node --max-old-space-size=3500 run-worker.js >> run-worker.out 2>&1 &
exit 0
