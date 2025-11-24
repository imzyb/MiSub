#!/bin/bash

# MiSub 订阅调试脚本
# 在 Cloudflare Pages Functions 环境中直接测试订阅获取

echo "=== MiSub 订阅获取调试测试 ==="
echo "测试订阅链接: https://liangxin.xyz/api/v1/liangxin?OwO=a3ddf1bf811e6106264da645f64be26e"
echo ""

# 1. 使用新的网络测试接口 - 详细测试
echo "1. 使用网络测试接口 (v2rayN/7.23)..."
curl -X POST "https://misub.526566.xyz/api/debug/fetch" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://liangxin.xyz/api/v1/liangxin?OwO=a3ddf1bf811e6106264da645f64be26e",
    "userAgent": "v2rayN/7.23"
  }' \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  -s

echo ""
echo "2. 使用网络测试接口 (curl UA)..."
curl -X POST "https://misub.526566.xyz/api/debug/fetch" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://liangxin.xyz/api/v1/liangxin?OwO=a3ddf1bf811e6106264da645f64be26e",
    "userAgent": "curl/7.68.0"
  }' \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  -s

echo ""
echo "3. 使用网络测试接口 (quantumultx UA)..."
curl -X POST "https://misub.526566.xyz/api/debug/fetch" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://liangxin.xyz/api/v1/liangxin?OwO=a3ddf1bf811e6106264da645f64be26e",
    "userAgent": "quantumult%20x"
  }' \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  -s

echo ""
echo "4. 测试节点数量获取..."
curl -X POST "https://misub.526566.xyz/api/nodes/count" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://liangxin.xyz/api/v1/liangxin?OwO=a3ddf1bf811e6106264da645f64be26e",
    "userAgent": "v2rayN/7.23"
  }' \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  -s

echo ""
echo "5. 测试订阅预览..."
curl -X POST "https://misub.526566.xyz/api/debug/preview" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://liangxin.xyz/api/v1/liangxin?OwO=a3ddf1bf811e6106264da645f64be26e",
    "userAgent": "v2rayN/7.23"
  }' \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  -s | jq '.contentInfo, .previewContent' 2>/dev/null || echo "JSON parsing failed"