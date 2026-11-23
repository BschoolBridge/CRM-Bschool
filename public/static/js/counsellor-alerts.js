(function () {
            let notifiedItems = new Set(); // Track notified items in this session
            let checkInterval = null;
            let notificationQueue = []; // Queue for multiple notifications
            let isShowingNotification = false;
            let checkerBooted = false;

            function getCsrfToken() {
                const match = document.cookie.match(/csrftoken=([^;]+)/);
                return match ? decodeURIComponent(match[1]) : '';
            }

            function markAssignmentNotificationsRead(inboxIds) {
                if (!inboxIds || !inboxIds.length) return;
                const body = new URLSearchParams();
                inboxIds.forEach(id => body.append('ids[]', id));
                fetch('/counsellor/notifications/assignment-read/', {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRFToken': getCsrfToken(),
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    credentials: 'same-origin',
                    body: body.toString(),
                }).catch(err => console.warn('Could not mark assignment notifications read', err));
            }
            
            function checkForNotifications() {
                fetch('/counsellor/notifications/check/', {
                    method: 'GET',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'same-origin'
                })
                .then(response => {
                    if (!response.ok) {
                        console.error('Notification check failed:', response.status);
                        return null;
                    }
                    return response.json();
                })
                .then(data => {
                    if (!data || !data.notifications || data.notifications.length === 0) {
                        return;
                    }
                    const leadAssigned = [];
                    const scheduled = [];
                    data.notifications.forEach(notification => {
                        const notificationId = notification.unique_id
                            || (notification.type === 'lead_assigned'
                                ? `lead_assigned_${notification.id}_${notification.assigned_at}`
                                : `${notification.type}_${notification.id}_${notification.scheduled_time}`);
                        if (notifiedItems.has(notificationId)) {
                            return;
                        }
                        notifiedItems.add(notificationId);
                        setTimeout(() => notifiedItems.delete(notificationId), 600000);
                        if (notification.type === 'lead_assigned') {
                            leadAssigned.push(notification);
                        } else {
                            scheduled.push(notification);
                        }
                    });
                    scheduled.forEach(n => notificationQueue.push(n));
                    if (leadAssigned.length > 0 && !isShowingNotification) {
                        showLeadAssignmentAlerts(leadAssigned);
                    } else if (!isShowingNotification && notificationQueue.length > 0) {
                        processNotificationQueue();
                    }
                })
                .catch(error => {
                    console.error('Error checking notifications:', error);
                });
            }
            
            function processNotificationQueue() {
                if (notificationQueue.length === 0) {
                    isShowingNotification = false;
                    return;
                }
                
                isShowingNotification = true;
                
                // If multiple notifications, show combined modal
                if (notificationQueue.length > 1) {
                    showMultipleNotificationsModal(notificationQueue);
                    notificationQueue = [];
                    isShowingNotification = false;
                } else {
                    // Show single notification
                    const notification = notificationQueue.shift();
                    showNotificationPopup(notification, () => {
                        // After closing, process next in queue
                        setTimeout(() => {
                            processNotificationQueue();
                        }, 500);
                    });
                }
            }
            
            function showMultipleNotificationsModal(notifications) {
                // Group by type
                const activities = notifications.filter(n => n.type === 'activity');
                const followups = notifications.filter(n => n.type === 'followup');
                
                const modalId = 'multiple-notifications-modal';
                let modalHtml = `
                    <div class="modal fade" id="${modalId}" tabindex="-1" role="dialog" data-backdrop="static" data-keyboard="false">
                        <div class="modal-dialog modal-lg modal-dialog-centered" role="document">
                            <div class="modal-content">
                                <div class="modal-header bg-info">
                                    <h5 class="modal-title text-white">
                                        <i class="fas fa-bell"></i> 
                                        Multiple Scheduled Items (${notifications.length})
                                    </h5>
                                    <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                                        <span aria-hidden="true">&times;</span>
                                    </button>
                                </div>
                                <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
                `;
                
                // Show activities section
                if (activities.length > 0) {
                    modalHtml += `
                        <div class="mb-4">
                            <h6 class="text-primary"><i class="fas fa-tasks"></i> Activities (${activities.length})</h6>
                            <div class="list-group">
                    `;
                    activities.forEach((notification, index) => {
                        const scheduledTime = new Date(notification.scheduled_time).toLocaleString();
                        modalHtml += `
                            <div class="list-group-item ${index < activities.length - 1 ? 'mb-2' : ''}">
                                <div class="d-flex w-100 justify-content-between">
                                    <h6 class="mb-1">${notification.title}</h6>
                                    <small class="text-muted">${scheduledTime}</small>
                                </div>
                                <p class="mb-1">${notification.message}</p>
                                ${notification.description ? `<p class="mb-1 small text-muted">${notification.description}</p>` : ''}
                                <a href="/counsellor/leads/${notification.lead_id}/" class="btn btn-sm btn-primary mt-2" onclick="$('#${modalId}').modal('hide');">
                                    <i class="fas fa-eye"></i> View ${notification.lead_name}
                                </a>
                            </div>
                        `;
                    });
                    modalHtml += `</div></div>`;
                }
                
                // Show follow-ups section
                if (followups.length > 0) {
                    modalHtml += `
                        <div class="mb-4">
                            <h6 class="text-success"><i class="fas fa-calendar"></i> Visits (${followups.length})</h6>
                            <div class="list-group">
                    `;
                    followups.forEach((notification, index) => {
                        const scheduledTime = new Date(notification.scheduled_time).toLocaleString();
                        modalHtml += `
                            <div class="list-group-item ${index < followups.length - 1 ? 'mb-2' : ''}">
                                <div class="d-flex w-100 justify-content-between">
                                    <h6 class="mb-1">${notification.title}</h6>
                                    <small class="text-muted">${scheduledTime}</small>
                                </div>
                                <p class="mb-1">${notification.message}</p>
                                ${notification.course_interested ? `<p class="mb-1 small text-muted"><strong>Course:</strong> ${notification.course_interested}</p>` : ''}
                                <a href="/counsellor/leads/${notification.lead_id}/" class="btn btn-sm btn-success mt-2" onclick="$('#${modalId}').modal('hide');">
                                    <i class="fas fa-eye"></i> View ${notification.lead_name}
                                </a>
                            </div>
                        `;
                    });
                    modalHtml += `</div></div>`;
                }
                
                modalHtml += `
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Dismiss All</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Remove existing modal if present
                const existingModal = document.getElementById(modalId);
                if (existingModal) {
                    existingModal.remove();
                }
                
                // Add modal to body
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                
                // Show modal
                $(`#${modalId}`).modal('show');
                
                // Play notification sound
                playNotificationSound();
                
                // Auto-dismiss after 60 seconds
                setTimeout(() => {
                    if ($(`#${modalId}`).is(':visible')) {
                        $(`#${modalId}`).modal('hide');
                    }
                }, 60000);
            }
            
            function dismissLeadAssignmentAlerts() {
                document.querySelectorAll('.lead-assignment-fixed-alert').forEach(el => el.remove());
            }

            function collectAssignmentInboxIds(notifications) {
                const ids = [];
                notifications.forEach(function(n) {
                    if (n.inbox_ids && n.inbox_ids.length) {
                        n.inbox_ids.forEach(function(id) {
                            if (id && ids.indexOf(id) === -1) ids.push(id);
                        });
                    } else if (n.inbox_id && ids.indexOf(n.inbox_id) === -1) {
                        ids.push(n.inbox_id);
                    }
                });
                return ids;
            }

            function showLeadAssignmentAlerts(leadAssigned) {
                if (!leadAssigned || !leadAssigned.length) {
                    return;
                }
                isShowingNotification = true;
                const inboxIds = collectAssignmentInboxIds(leadAssigned);
                const onDone = function() {
                    markAssignmentNotificationsRead(inboxIds);
                    isShowingNotification = false;
                    if (notificationQueue.length > 0) {
                        processNotificationQueue();
                    }
                };
                const first = leadAssigned[0];
                if (leadAssigned.length === 1 && !first.batch && (first.total_count || 0) <= 1) {
                    showLeadAssignedPopup(first, onDone);
                } else {
                    showLeadAssignmentSummary(leadAssigned, onDone);
                }
            }

            function showLeadAssignmentFixedAlert(innerHtml, onClose) {
                dismissLeadAssignmentAlerts();
                const wrap = document.createElement('div');
                wrap.className = 'lead-assignment-fixed-alert';
                wrap.innerHTML = innerHtml;
                document.body.appendChild(wrap);
                playNotificationSound();
                wrap.querySelectorAll('.lead-assign-dismiss').forEach(btn => {
                    btn.addEventListener('click', function() {
                        dismissLeadAssignmentAlerts();
                        if (onClose) onClose();
                    });
                });
                setTimeout(function() {
                    if (document.body.contains(wrap)) {
                        dismissLeadAssignmentAlerts();
                        if (onClose) onClose();
                    }
                }, 60000);
            }

            function buildLeadAssignmentCard(title, iconClass, bodyHtml, footerHtml) {
                return `
                    <div class="card card-primary card-outline mb-0">
                        <div class="card-header bg-primary">
                            <h3 class="card-title"><i class="fas ${iconClass} mr-1"></i> ${title}</h3>
                            <div class="card-tools">
                                <button type="button" class="btn btn-tool lead-assign-dismiss" aria-label="Close">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        <div class="card-body">${bodyHtml}</div>
                        <div class="card-footer d-flex justify-content-end flex-wrap">${footerHtml}</div>
                    </div>
                `;
            }

            function showLeadAssignedPopup(notification, onClose) {
                const sourceLabel = notification.source_name || 'Unknown';
                const sourceLink = notification.source_id
                    ? `/counsellor/leads/?source=${notification.source_id}`
                    : '/counsellor/leads/';
                const bodyHtml = `
                    <div class="d-flex align-items-center">
                        <div class="lead-assign-total-label mb-0">Assigned to you</div>
                    </div>
                    <div class="lead-assign-total mt-1">1 lead</div>
                    <div class="callout callout-info py-2 px-3 mb-0 mt-3">
                        <p class="mb-0"><strong>Lead source</strong></p>
                        <p class="mb-0 mt-1"><span class="badge badge-primary">${sourceLabel}</span></p>
                    </div>
                `;
                const footerHtml = `
                    <button type="button" class="btn btn-default btn-sm lead-assign-dismiss mr-2 mb-1">Dismiss</button>
                    <a href="${sourceLink}" class="btn btn-primary btn-sm mb-1"><i class="fas fa-list mr-1"></i> My leads</a>
                `;
                showLeadAssignmentFixedAlert(
                    buildLeadAssignmentCard('New lead assigned', 'fa-user-plus', bodyHtml, footerHtml),
                    onClose
                );
            }

            function mergeLeadAssignmentSummaries(notifications) {
                const bySource = {};
                let total = 0;
                notifications.forEach(function(n) {
                    if (n.batch || (n.total_count && n.total_count > 1)) {
                        total += n.total_count || 0;
                        (n.sources || []).forEach(function(s) {
                            bySource[s.name] = (bySource[s.name] || 0) + s.count;
                        });
                    } else {
                        total += 1;
                        const src = n.source_name || 'Unknown';
                        bySource[src] = (bySource[src] || 0) + 1;
                    }
                });
                const sources = Object.keys(bySource).sort().map(function(name) {
                    return { name: name, count: bySource[name] };
                });
                return { total_count: total, sources: sources };
            }

            function showLeadAssignmentSummary(notifications, onClose) {
                const summary = mergeLeadAssignmentSummaries(notifications);
                const total = summary.total_count || notifications.length;
                let sourceHtml = '';
                (summary.sources || []).forEach(function(s) {
                    sourceHtml += `
                        <div class="lead-assign-source-row">
                            <span class="lead-assign-source-name">${s.name}</span>
                            <span class="badge badge-primary">${s.count}</span>
                        </div>
                    `;
                });
                if (!sourceHtml) {
                    sourceHtml = '<p class="mb-0 text-muted small">Source breakdown unavailable.</p>';
                } else {
                    sourceHtml = `<div class="lead-assign-sources">${sourceHtml}</div>`;
                }
                const bodyHtml = `
                    <div class="lead-assign-total-label">Assigned to you</div>
                    <div class="lead-assign-total">${total} leads</div>
                    <p class="text-muted small mb-2 mt-2"><i class="fas fa-layer-group mr-1"></i> Lead sources</p>
                    ${sourceHtml}
                `;
                const footerHtml = `
                    <button type="button" class="btn btn-default btn-sm lead-assign-dismiss mr-2 mb-1">Dismiss</button>
                    <a href="/counsellor/leads/" class="btn btn-primary btn-sm mb-1"><i class="fas fa-list mr-1"></i> My leads</a>
                `;
                showLeadAssignmentFixedAlert(
                    buildLeadAssignmentCard('New leads assigned', 'fa-users', bodyHtml, footerHtml),
                    onClose
                );
            }

            function showNotificationPopup(notification, onClose) {
                // Create modal HTML
                const modalId = `notification-modal-${notification.type}-${notification.id}-${Date.now()}`;
                const modalHtml = `
                    <div class="modal fade" id="${modalId}" tabindex="-1" role="dialog" data-backdrop="static" data-keyboard="false">
                        <div class="modal-dialog modal-dialog-centered" role="document">
                            <div class="modal-content">
                                <div class="modal-header ${notification.type === 'activity' ? 'bg-primary' : 'bg-success'}">
                                    <h5 class="modal-title text-white">
                                        <i class="fas fa-${notification.type === 'activity' ? 'tasks' : 'calendar'}"></i> 
                                        ${notification.title}
                                    </h5>
                                    <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                                        <span aria-hidden="true">&times;</span>
                                    </button>
                                </div>
                                <div class="modal-body">
                                    <p class="lead">${notification.message}</p>
                                    ${notification.description ? `<p><strong>Description:</strong> ${notification.description}</p>` : ''}
                                    ${notification.course_interested ? `<p><strong>Course Interested:</strong> ${notification.course_interested}</p>` : ''}
                                    <p class="text-muted">
                                        <i class="fas fa-clock"></i> 
                                        Scheduled: ${new Date(notification.scheduled_time).toLocaleString()}
                                    </p>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Dismiss</button>
                                    <a href="/counsellor/leads/${notification.lead_id}/" class="btn btn-primary" onclick="$('#${modalId}').modal('hide');">
                                        <i class="fas fa-eye"></i> View Lead Details
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Remove existing modal if present
                const existingModal = document.getElementById(modalId);
                if (existingModal) {
                    existingModal.remove();
                }
                
                // Add modal to body
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                
                // Show modal with sound notification
                $(`#${modalId}`).modal('show');
                
                // Handle close event
                $(`#${modalId}`).on('hidden.bs.modal', function() {
                    if (onClose) {
                        onClose();
                    }
                });
                
                // Play notification sound
                playNotificationSound();
                
                // Auto-dismiss after 30 seconds if not manually closed
                setTimeout(() => {
                    if ($(`#${modalId}`).is(':visible')) {
                        $(`#${modalId}`).modal('hide');
                    }
                }, 30000);
            }
            
            function playNotificationSound() {
                try {
                    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZUg4OUKfk8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQYxh9Hz04IzBh5uwO/jmVIO');
                    audio.play().catch(e => console.log('Audio play failed:', e));
                } catch (e) {
                    console.log('Audio not supported');
                }
            }
            
            function showServerAssignmentAlertsOnLoad() {
                const el = document.getElementById('counsellor-assignment-alerts-data');
                if (!el) {
                    return;
                }
                let alerts = [];
                try {
                    alerts = JSON.parse(el.textContent);
                } catch (e) {
                    console.warn('Could not parse assignment alerts', e);
                    return;
                }
                if (!alerts.length) {
                    return;
                }
                alerts.forEach(function(notification) {
                    const notificationId = notification.unique_id
                        || ('lead_assigned_' + notification.id + '_' + notification.assigned_at);
                    if (!notifiedItems.has(notificationId)) {
                        notifiedItems.add(notificationId);
                    }
                });
                showLeadAssignmentAlerts(alerts);
            }

            function startNotificationChecker() {
                if (checkInterval) {
                    return;
                }
                checkForNotifications();
                checkInterval = setInterval(checkForNotifications, 10000);
            }

            function bootNotificationChecker() {
                if (checkerBooted) {
                    return;
                }
                checkerBooted = true;
                showServerAssignmentAlertsOnLoad();
                startNotificationChecker();
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', bootNotificationChecker);
            } else {
                bootNotificationChecker();
            }
            
            // Stop checking when page is hidden to save resources
            document.addEventListener('visibilitychange', function() {
                if (document.hidden) {
                    if (checkInterval) {
                        clearInterval(checkInterval);
                        checkInterval = null;
                    }
                } else {
                    if (!checkInterval) {
                        startNotificationChecker();
                    }
                }
            });
        })();
