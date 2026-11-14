import {Config} from '@remotion/cli/config';
import fs from 'node:fs';

Config.setVideoImageFormat('png'); // png keeps yuv420p (jpeg frames yield yuvj420p)
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');
Config.setConcurrency(4);

// Use a locally installed Chromium when present (cloud container / CI),
// otherwise Remotion downloads its own headless shell.
const local = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
if (fs.existsSync(local)) Config.setBrowserExecutable(local);
