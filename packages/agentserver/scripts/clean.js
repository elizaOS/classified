#!/usr/bin/env bun
// Clean script for ElizaOS Agent Server
// Removes existing containers and images

import { cleanContainerCache } from './build-all.js';

// Run the clean function
await cleanContainerCache(); 