
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_updated_at ON subscriptions(updated_at);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);

CREATE TABLE IF NOT EXISTS vps_nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tag TEXT,
    group_tag TEXT,
    region TEXT,
    country_code TEXT,
    description TEXT,
    secret TEXT NOT NULL,
    status TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    use_global_targets INTEGER DEFAULT 0,
    total_rx INTEGER DEFAULT 0,
    total_tx INTEGER DEFAULT 0,
    traffic_limit_gb INTEGER DEFAULT 0,
    last_seen_at DATETIME,
    last_report_json TEXT,
    overload_state_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vps_reports (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    reported_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vps_alerts (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vps_nodes_updated_at ON vps_nodes(updated_at);
CREATE INDEX IF NOT EXISTS idx_vps_reports_node_time ON vps_reports(node_id, reported_at);
CREATE INDEX IF NOT EXISTS idx_vps_alerts_node_time ON vps_alerts(node_id, created_at);

CREATE TABLE IF NOT EXISTS vps_network_targets (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    type TEXT NOT NULL,
    target TEXT NOT NULL,
    name TEXT,
    scheme TEXT,
    port INTEGER,
    path TEXT,
    enabled INTEGER DEFAULT 1,
    force_check_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vps_network_targets_node ON vps_network_targets(node_id, created_at);

CREATE TABLE IF NOT EXISTS vps_network_samples (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    reported_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vps_network_samples_node_time ON vps_network_samples(node_id, reported_at);
