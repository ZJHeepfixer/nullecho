#!/bin/bash
# Nullecho: show this computer's real graphics name, the way Google Chrome reports it.
# Used to verify Nullecho's Linux device profiles against real hardware (docs/LINUX-PERSONA-VERIFICATION.md).
#
# Run it inside Ubuntu's "Try Ubuntu" live session:   wget -qO- nullecho.org/gpu.sh | bash
# It installs Google Chrome into the LIVE session only: nothing is written to the laptop's own disk, and
# everything is gone when the laptop restarts. It sends nothing anywhere; it opens nullecho.org, whose
# fingerprint demo runs entirely in the browser.
set -e

echo
echo "== This laptop's graphics hardware:"
lspci -nn | grep -iE 'vga|3d|display' || echo "(lspci found no display device)"
echo

echo "== Getting Google Chrome (about 110 MB; needs Wi-Fi)…"
sudo apt-get update -qq
cd /tmp
wget -q --show-progress -O chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt-get install -y -qq ./chrome.deb > /dev/null

echo
echo "== Opening nullecho.org in Chrome."
echo "   Click  'Show me my fingerprint'  and take a phone photo of the 'Graphics card' line,"
echo "   and one of THIS window (the graphics hardware line above)."
echo
google-chrome --no-first-run --no-default-browser-check "https://nullecho.org/" > /dev/null 2>&1 &
