import dayjs from 'dayjs'
import { DatetimeHelper, FilterTableSet, LogTemplate } from '.'

export const LOGS_LARGE_DATE_RANGE_DAYS_THRESHOLD = 4

export const TEMPLATES: LogTemplate[] = [
  {
    label: 'Recent Errors',
    mode: 'simple',
    searchString: '[Ee]rror|\\s[45][0-9][0-9]\\s',
    for: ['api'],
  },
  {
    label: 'Commits',
    mode: 'simple',
    searchString: 'COMMIT',
    for: ['database'],
  },
  {
    label: 'Commits By User',
    description: 'Count of commits made by users on the database',
    mode: 'custom',
    searchString: `select
    p.user_name, count(*) as count
from postgres_logs
  left join unnest(metadata) as m on true
  left join unnest(m.parsed) as p on true
where
  regexp_contains(event_message, 'COMMIT')
group by
  p.user_name
    `,
    for: ['database'],
  },
  {
    label: 'Metadata IP',
    description: 'List all IP addresses that used the Supabase API',
    mode: 'custom',
    searchString: `select timestamp, h.x_real_ip
from edge_logs
  left join unnest(metadata) as m on true
  left join unnest(m.request) as r on true
  left join unnest(r.headers) as h on true
where h.x_real_ip is not null
`,
    for: ['api'],
  },
  {
    label: 'Requests by Country',
    description: 'List all ISO 3166-1 alpha-2 country codes that used the Supabase API',
    mode: 'custom',
    searchString: `select 
  cf.country, count(*) as count
from edge_logs
  left join unnest(metadata) as m on true
  left join unnest(m.request) as r on true
  left join unnest(r.cf) as cf on true
group by
  cf.country
order by
  count desc
`,
    for: ['api'],
  },
  {
    label: 'Slow Response Time',
    mode: 'custom',
    description: 'List all Supabase API requests that are slow',
    searchString: `select
  timestamp, 
  event_message,
  r.origin_time
from edge_logs
  cross join unnest(metadata) as m 
  cross join unnest(m.response) as r
where
  r.origin_time > 1000
order by
  timestamp desc
limit 100
`,
    for: ['api'],
  },
  {
    label: '500 Request Codes',
    description: 'List all Supabase API requests that responded witha 5XX status code',
    mode: 'custom',
    searchString: `SELECT
  timestamp, 
  event_message,
  r.status_code
from edge_logs
  cross join unnest(metadata) as m 
  cross join unnest(m.response) as r
where
  r.status_code >= 500
order by
  timestamp desc
limit 100
`,
    for: ['api'],
  },
  {
    label: 'Top Paths',
    description: 'List the most requested Supabase API paths',
    mode: 'custom',
    searchString: `SELECT
  r.path as path,
  r.search as params,
  count(timestamp) as c
from edge_logs
  cross join unnest(metadata) as m 
  cross join unnest(m.request) as r
group by 
  path,
  params 
order by
  c desc
limit 100
`,
    for: ['api'],
  },
  {
    label: 'REST Requests',
    description: 'List all PostgREST requests',
    mode: 'custom',
    searchString: `SELECT
  timestamp,
  event_message
from edge_logs
  cross join unnest(metadata) as m 
  cross join unnest(m.request) as r
where
  path like '%rest/v1%'
order by
  timestamp desc
limit 100
`,
    for: ['api'],
  },
  {
    label: 'Errors',
    description: 'List all Postgres error messages with ERROR, FATAL, or PANIC severity',
    mode: 'custom',
    searchString: `SELECT
  t.timestamp,
  p.error_severity,
  event_message
from
  postgres_logs as t
    cross join unnest(metadata) as m
    cross join unnest(m.parsed) as p
where
  p.error_severity in ('ERROR', 'FATAL', 'PANIC')
order by
  timestamp desc
limit 100
`,
    for: ['database'],
  },
  {
    label: 'Error Count by User',
    mode: 'custom',
    searchString: `select
  count(t.timestamp) as count,
  p.user_name,
  p.error_severity
from
  postgres_logs as t
    cross join unnest(metadata) as m
    cross join unnest(m.parsed) as p
where
  p.error_severity in ('ERROR', 'FATAL', 'PANIC')
group by
  p.user_name,
  p.error_severity
order by
  count desc
limit 100
`,
    for: ['database'],
  },
]

export const LOG_TYPE_LABEL_MAPPING: { [k: string]: string } = {
  explorer: 'Explorer',
  api: 'API',
  database: 'Database',
}

const _SQL_FILTER_COMMON = {
  search_query: (value: string) => `regexp_contains(event_message, '${value}')`,
}

export const SQL_FILTER_TEMPLATES: any = {
  postgres_logs: {
    ..._SQL_FILTER_COMMON,
    'severity.error': `metadataParsed.error_severity in ('ERROR', 'FATAL', 'PANIC')`,
    'severity.noError': `metadataParsed.error_severity not in ('ERROR', 'FATAL', 'PANIC')`,
    'severity.log': `metadataParsed.error_severity = 'LOG'`,
  },
  edge_logs: {
    ..._SQL_FILTER_COMMON,
    'status_code.error': `response.status_code between 500 and 599`,
    'status_code.success': `response.status_code between 200 and 299`,
    'status_code.warning': `response.status_code between 400 and 499`,

    'product.database': `request.path like '/rest/%' or request.path like '/graphql/%'`,
    'product.storage': `request.path like '/storage/%'`,
    'product.auth': `request.path like '/auth/%'`,
    'product.realtime': `request.path like '/realtime/%'`,

    'method.get': `request.method = 'GET'`,
    'method.post': `request.method = 'POST'`,
    'method.del': `request.method = 'DEL'`,
    'method.options': `request.method = 'OPTIONS'`,
  },
  function_edge_logs: {
    ..._SQL_FILTER_COMMON,
    'status_code.error': `response.status_code between 500 and 599`,
    'status_code.success': `response.status_code between 200 and 299`,
    'status_code.warning': `response.status_code between 400 and 499`,
  },
  function_logs: {
    ..._SQL_FILTER_COMMON,
    'severity.error': `metadata.level = 'error'`,
    'severity.notError': `metadata.level != 'error'`,
    'severity.log': `metadata.level = 'log'`,
    'severity.info': `metadata.level = 'info'`,
    'severity.debug': `metadata.level = 'debug'`,
  },
}


export enum LogsTableName {
  EDGE = 'edge_logs',
  POSTGRES = 'postgres_logs',
  FUNCTIONS = 'function_logs',
  FN_EDGE = 'function_edge_logs',
}

export const LOGS_TABLES = {
  api: LogsTableName.EDGE,
  database: LogsTableName.POSTGRES,
  functions: LogsTableName.FUNCTIONS,
  fn_edge: LogsTableName.FN_EDGE,
}

export const LOGS_SOURCE_DESCRIPTION = {
  [LogsTableName.EDGE]: 'Logs obtained from the network edge, containing all API requests.',
  [LogsTableName.POSTGRES]: 'Database logs obtained directly from Postgres.',
  [LogsTableName.FUNCTIONS]: 'Function logs generated from runtime execution.',
  [LogsTableName.FN_EDGE]: 'Function call logs, containing the request and response.',
}

export const genCountQuery = (table: string): string => `SELECT count(*) as count FROM ${table}`

export const genQueryParams = (params: { [k: string]: string }) => {
  // remove keys which are empty strings, null, or undefined
  for (const k in params) {
    const v = params[k]
    if (v === null || v === '' || v === undefined) {
      delete params[k]
    }
  }
  const qs = new URLSearchParams(params).toString()
  return qs
}
export const FILTER_OPTIONS: FilterTableSet = {
  // Postgres logs
  postgres_logs: {
    severity: {
      label: 'Severity',
      key: 'severity',
      options: [
        {
          key: 'error',
          label: 'Error',
          description: 'Show all events with ERROR, PANIC, or FATAL',
        },
        {
          key: 'noError',
          label: 'No Error',
          description: 'Show all non-error events',
        },
        {
          key: 'log',
          label: 'Log',
          description: 'Show all events that are log severity',
        },
      ],
    },
  },

  // Edge logs
  edge_logs: {
    status_code: {
      label: 'Status',
      key: 'status_code',
      options: [
        {
          key: 'error',
          label: 'Error',
          description: '500 error codes',
        },
        {
          key: 'success',
          label: 'Success',
          description: '200 codes',
        },
        {
          key: 'warning',
          label: 'Warning',
          description: '400 codes',
        },
      ],
    },
    product: {
      label: 'Product',
      key: 'product',
      options: [
        {
          key: 'database',
          label: 'Database',
          description: '',
        },
        {
          key: 'auth',
          label: 'Auth',
          description: '',
        },
        {
          key: 'storage',
          label: 'Storage',
          description: '',
        },
        {
          key: 'realtime',
          label: 'Realtime',
          description: '',
        },
      ],
    },
    method: {
      label: 'Method',
      key: 'method',
      options: [
        {
          key: 'get',
          label: 'GET',
          description: '',
        },
        {
          key: 'options',
          label: 'OPTIONS',
          description: '',
        },
        {
          key: 'post',
          label: 'POST',
          description: '',
        },
      ],
    },
  },
  // function_edge_logs
  function_edge_logs: {
    status_code: {
      label: 'Status',
      key: 'status_code',
      options: [
        {
          key: 'error',
          label: 'Error',
          description: '500 error codes',
        },
        {
          key: 'success',
          label: 'Success',
          description: '200 codes',
        },
        {
          key: 'warning',
          label: 'Warning',
          description: '400 codes',
        },
      ],
    },
  },
  // function_logs
  function_logs: {
    severity: {
      label: 'Severity',
      key: 'severity',
      options: [
        {
          key: 'error',
          label: 'Error',
          description: 'Show all events that have error severity',
        },
        {
          key: 'info',
          label: 'Info',
          description: 'Show all events that have error severity',
        },
        {
          key: 'debug',
          label: 'Debug',
          description: 'Show all events that have error severity',
        },
        {
          key: 'log',
          label: 'Log',
          description: 'Show all events that are log severity',
        },
      ],
    },
  },
}

export const LOGS_TAILWIND_CLASSES = {
  log_selection_x_padding: 'px-8',
  space_y: 'px-6',
}

export const PREVIEWER_DATEPICKER_HELPERS: DatetimeHelper[] = [
  {
    text: 'Last hour',
    calcFrom: () => dayjs().subtract(1, 'hour').startOf('hour').toISOString(),
    calcTo: () => '',
  },
  {
    text: 'Last 3 hours',
    calcFrom: () => dayjs().subtract(3, 'hour').startOf('hour').toISOString(),
    calcTo: () => '',
  },
  {
    text: 'Last day',
    calcFrom: () => dayjs().subtract(1, 'day').startOf('day').toISOString(),
    calcTo: () => '',
    default: true,
  },
]
export const EXPLORER_DATEPICKER_HELPERS: DatetimeHelper[] = [
  {
    text: 'Last day',
    calcFrom: () => dayjs().subtract(1, 'day').startOf('day').toISOString(),
    calcTo: () => '',
    default: true,
  },
  {
    text: 'Last 3 days',
    calcFrom: () => dayjs().subtract(3, 'day').startOf('day').toISOString(),
    calcTo: () => '',
  },
  {
    text: 'Last 7 days',
    calcFrom: () => dayjs().subtract(7, 'day').startOf('day').toISOString(),
    calcTo: () => '',
  },
]

export const getDefaultHelper = (helpers: DatetimeHelper[]) =>
  helpers.find((helper) => helper.default) || helpers[0]

export const TIER_QUERY_LIMITS = {
  FREE: { text: '1 day', value: 1, unit: 'day' },
  PRO: { text: '7 days', value: 7, unit: 'day' },
  PAYG: { text: '3 months', value: 3, unit: 'month' },
}
