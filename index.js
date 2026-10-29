'use strict';
// Keep the thread pool small: SiteGround shared hosting limits processes/threads ("Failed to fork").
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '2';
require('./src/server');
