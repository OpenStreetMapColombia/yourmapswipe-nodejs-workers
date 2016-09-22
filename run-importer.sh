#!/bin/bash
nohup node --max-old-space-size=3500 import-mapswipe.js >> import-mapswipe.out 2>&1 &
exit 0
