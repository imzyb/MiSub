/**
 * Cron Triggers 配置
 * 这个文件定义了定时任务的执行频率
 */

export const cron = {
    // 每小时执行一次订阅同步
    '0 * * * *': {
        name: 'hourly-subscription-sync',
        description: '每小时同步一次订阅数据'
    },

    // 每天早上8点执行完整同步
    '0 8 * * *': {
        name: 'daily-full-sync',
        description: '每天早上8点执行完整订阅同步'
    },

    // 每30分钟检查一次流量使用情况
    '*/30 * * * *': {
        name: 'traffic-check',
        description: '每30分钟检查一次流量使用情况'
    }
};