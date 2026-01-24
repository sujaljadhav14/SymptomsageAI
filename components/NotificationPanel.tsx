import React from 'react';
import { Bell, X, Lightbulb, Clock, Heart, TrendingUp } from 'lucide-react';
import { Notification, NotificationType } from '../types';

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    onMarkAsRead: (id: string) => void;
}

const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
        case NotificationType.HEALTH_TIP:
            return <Lightbulb className="w-4 h-4 text-amber-500" />;
        case NotificationType.FOLLOW_UP:
            return <Clock className="w-4 h-4 text-blue-500" />;
        case NotificationType.REMINDER:
            return <Heart className="w-4 h-4 text-rose-500" />;
        case NotificationType.INSIGHT:
            return <TrendingUp className="w-4 h-4 text-emerald-500" />;
        default:
            return <Bell className="w-4 h-4 text-slate-400" />;
    }
};

const getNotificationBg = (type: NotificationType) => {
    switch (type) {
        case NotificationType.HEALTH_TIP:
            return 'bg-amber-50 border-amber-100';
        case NotificationType.FOLLOW_UP:
            return 'bg-blue-50 border-blue-100';
        case NotificationType.REMINDER:
            return 'bg-rose-50 border-rose-100';
        case NotificationType.INSIGHT:
            return 'bg-emerald-50 border-emerald-100';
        default:
            return 'bg-slate-50 border-slate-100';
    }
};

const NotificationPanel: React.FC<NotificationPanelProps> = ({
    isOpen,
    onClose,
    notifications,
    onMarkAsRead
}) => {
    const unreadCount = notifications.filter(n => !n.isRead).length;

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <Bell className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">Notifications</h2>
                            {unreadCount > 0 && (
                                <p className="text-xs text-white/70">{unreadCount} new updates</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {notifications.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Bell className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="font-bold text-slate-700 mb-2">All Caught Up!</h3>
                            <p className="text-sm text-slate-500">
                                No new notifications. Complete an assessment to receive AI-powered health insights.
                            </p>
                        </div>
                    ) : (
                        notifications.map((notification) => (
                            <div
                                key={notification.id}
                                onClick={() => onMarkAsRead(notification.id)}
                                className={`p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md ${getNotificationBg(notification.type)} ${!notification.isRead ? 'ring-2 ring-blue-200' : 'opacity-75'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-sm text-slate-800 truncate">
                                                {notification.title}
                                            </h4>
                                            {!notification.isRead && (
                                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                                            {notification.message}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-2 font-medium">
                                            {notification.timestamp.toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                        <p className="text-[10px] text-slate-400 text-center font-medium uppercase tracking-wider">
                            AI-powered health insights from SymptomSage
                        </p>
                    </div>
                )}
            </div>
        </>
    );
};

export default NotificationPanel;
