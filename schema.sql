
-- D1 节点持久化：每个「订阅 + 配置指纹」一条快照；仅 state=ready 参与订阅组输出
CREATE TABLE IF NOT EXISTS subscription_node_snapshots (
    subscription_id TEXT PRIMARY KEY,
    config_fingerprint TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending',
    nodes_json TEXT NOT NULL DEFAULT '[]',
    node_count INTEGER NOT NULL DEFAULT 0,
    user_info_json TEXT,
    last_success_at DATETIME,
    last_attempt_at DATETIME,
    last_error TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 超大订阅的节点分片（单条订阅节点过多时按 256KB 切片）
CREATE TABLE IF NOT EXISTS subscription_node_snapshot_chunks (
    subscription_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    nodes_json TEXT NOT NULL,
    PRIMARY KEY (subscription_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_node_snapshot_chunks_sub ON subscription_node_snapshot_chunks(subscription_id);

CREATE INDEX IF NOT EXISTS idx_node_snapshots_refresh ON subscription_node_snapshots(last_success_at);

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
