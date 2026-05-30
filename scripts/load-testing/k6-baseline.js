import http from 'k6/http';
import { check, sleep } from 'k6';

// Configuration for load test
export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users over 30s
    { duration: '1m', target: 20 },  // Stay at 20 users for 1m
    { duration: '30s', target: 0 },  // Ramp down to 0 users over 30s
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
  },
};

const SUPABASE_URL = __ENV.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export default function () {
  // Replace with the actual API endpoint you want to test (e.g. fetching galleries)
  const url = `${SUPABASE_URL}/rest/v1/galleries?select=*`;

  const params = {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  const res = http.get(url, params);

  check(res, {
    'is status 200': (r) => r.status === 200,
    'response time is acceptable': (r) => r.timings.duration < 500,
  });

  // Simulate user reading the response before next request
  sleep(1);
}
