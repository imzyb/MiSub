#!/bin/bash

# 测试 v2rayN + Subconverter 回退机制
echo "=== 测试 v2rayN + Subconverter 回退机制 ==="
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

echo "2. 测试节点数量获取（v2rayN + subconverter回退）..."
response=$(curl -s -X POST "https://misub.526566.xyz/api/node_count" \
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
    echo "✅ 成功！回退机制工作正常，成功获取到 $node_count 个节点"
    echo "方案5（subconverter）可能已经生效"
else
    echo "❌ 仍然失败，需要进一步调试 subconverter 配置"
    echo "原始响应："
    echo "$response"
fi

echo ""
echo "3. 测试订阅预览功能..."
preview_response=$(curl -s -X POST "https://misub.526566.xyz/api/debug/preview" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_FILE" \
  -d '{
    "url": "https://liangxin.xyz/api/v1/liangxin?OwO=a3ddf1bf811e6106264da645f64be26e",
    "userAgent": "v2rayN/7.23"
  }')

preview_count=$(echo "$preview_response" | jq '.subscriptions[0].nodes | length' 2>/dev/null || echo "0")
echo "订阅预览获取到的节点数量: $preview_count"

if [ "$preview_count" -gt 0 ]; then
    echo "✅ 订阅预览也成功！"
else
    echo "❌ 订阅预览失败"
fi

# 清理会通过trap自动执行