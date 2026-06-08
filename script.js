import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const rateLimited = new Counter('rate_limited_429');
const success200 = new Counter('success_200');
const errorRate = new Rate('errors');

const BASE_URL =
  __ENV.BASE_URL || 'https://pipi-production-e827.up.railway.app';

const API_PATH =
  __ENV.API_PATH ||
  '/v2/merchants?page=1&limit=20&lat=34.477499167993&lng=35.93290826743124';

const TARGET_VUS = Number(__ENV.VUS || 2000);
const TEST_DURATION = __ENV.DURATION || '2m';
// Realistic browse interval (seconds). Lower = harder stress test.
const THINK_TIME_SEC = Number(__ENV.SLEEP || 2);

export const options = {
  scenarios: {
    merchants_browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.floor(TARGET_VUS / 2) },
        { duration: '30s', target: TARGET_VUS },
        { duration: TEST_DURATION, target: TARGET_VUS },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '20s',
    },
  },
  thresholds: {
    errors: ['rate<0.05'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}${API_PATH}`, {
    tags: { name: 'v2_merchants_list' },
  });

  if (res.status === 200) {
    success200.add(1);
    errorRate.add(false);
  } else if (res.status === 429) {
    rateLimited.add(1);
    errorRate.add(false);
  } else {
    errorRate.add(true);
  }

  check(res, {
    '200 OK or 429 rate limited': (r) => r.status === 200 || r.status === 429,
  });

  sleep(THINK_TIME_SEC);
}

export function handleSummary(data) {
  const lines = [
    'k6 summary (v2 merchants load test)',
    `BASE_URL=${BASE_URL}`,
    `API_PATH=${API_PATH}`,
    `targetVUs=${TARGET_VUS}`,
    `thinkTimeSec=${THINK_TIME_SEC}`,
    `http_reqs=${data.metrics.http_reqs?.values?.count ?? 0}`,
    `success_200=${data.metrics.success_200?.values?.count ?? 0}`,
    `rate_limited_429=${data.metrics.rate_limited_429?.values?.count ?? 0}`,
    `p95 latency ms=${data.metrics.http_req_duration?.values?.['p(95)'] ?? 'n/a'}`,
  ];
  return {
    stdout: lines.join('\n') + '\n',
  };
}
