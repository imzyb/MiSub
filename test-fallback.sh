#!/bin/bash

# 测试智能 User-Agent 回退机制
echo "=== 测试智能 User-Agent 回退机制 ==="
echo ""

# 使用临时目录存储cookie
COOKIE_DIR=$(mktemp -d)
COOKIE_FILE="$COOKIE_DIR/cookies.txt"

# 清理函数
cleanup() {
    rm -rf "$COOKIE_DIR"
}
trap cleanup EXIT

# 登录获取会话
echo "1. 登录获取会话..."
curl -s -X POST "https://misub.526566.xyz/api/login" \
  -H "Content-Type: application/json" \
  -d '{"password": "mbmbmb"}' \
  -c "$COOKIE_FILE" > /dev/null

if [ ! -f "$COOKIE_FILE" ]; then
    echo "❌ 登录失败"
    exit 1
fi

echo "2. 测试节点数量获取（使用新的回退机制）..."
response=$(curl -s -X POST "https://misub.526566.xyz/api/nodes/count" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_FILE" \
  -d '{
    "url": "https://liangxin.xyz/api/v1/liangxin?OwO=a3ddf1bf811e6106264da645f64be26e",
    "userAgent": "v2rayN/7.23"
  }')

echo "响应结果:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"

# 提取节点数量
node_count=$(echo "$response" | jq '.count' 2>/dev/null || echo "0")
echo ""
echo "=== 测试结果 ==="
echo "获取到的节点数量: $node_count"

if [ "$node_count" -gt 0 ]; then
    echo "✅ 成功！智能回退机制工作正常，成功获取到 $node_count 个节点"
else
    echo "❌ 仍然失败，可能需要进一步调试"
    echo "原始响应："
    echo "$response"
fi

# 清理会通过trap自动执行