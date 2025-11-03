import * as React from 'react';
import { useEffect, useState } from "react";
import { Spinner } from '@fluentui/react';
import { 
    IconCircleX, 
    IconCalendar, 
    IconAlertCircle, 
    IconExternalLink, 
    IconFilter, 
    IconClock
} from '@tabler/icons-react';
import { CheckmarkCircle24Filled, Circle24Regular } from "@fluentui/react-icons";
import { fetchAllTasks } from './fetchTasks';
import { FilterScope, IPriorityTasksBoardProps, ITask } from './interfaces/IPriorityTasksBoard';

export const PriorityTasksBoard: React.FC<IPriorityTasksBoardProps> = ({ context, inspectionDataSet }) => {
    const [tasks, setTasks] = useState<ITask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [filterScope, setFilterScope] = useState<FilterScope>('all');
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [selectedTask, setSelectedTask] = useState<ITask | null>(null);

    //fetch tasks once on first render and again when the dataset or context changes
    useEffect(() => {
        const loadTasks = async (): Promise<void> => {
            try {
                setIsLoading(true);
                const fetchedTasks: ITask[] = await fetchAllTasks(context, inspectionDataSet);
                setTasks(fetchedTasks);
            } catch (error: unknown) {  
                console.error("Error loading tasks:", error);
                setIsError(true);
            } finally {
                setIsLoading(false);
            }
        };

        void loadTasks();
    }, [context, inspectionDataSet]);

    //filter tasks based on time scope
    const getFilteredTasks = (): ITask[] => {
        const now = new Date();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        switch (filterScope) {
            case 'today':
                return tasks.filter(task => {
                    const taskDate = task.startDate ?? task.expectedEndDate;
                    return taskDate && taskDate <= endOfToday;
                });
            case 'next7days':
                return tasks.filter(task => {
                    const taskDate = task.startDate ?? task.expectedEndDate;
                    return taskDate && taskDate <= next7Days;
                });
            case 'all':
            default:
                return tasks;
        }
    };

    //group tasks by priority
    const groupedTasks = {
        High: getFilteredTasks().filter(t => t.priority === 'High'),
        Medium: getFilteredTasks().filter(t => t.priority === 'Medium'),
        Low: getFilteredTasks().filter(t => t.priority === 'Low')
    };

    const priorityConfig = {
        High: {
            label: 'Immediate',
            color: '#C91432',
            bgColor: '#FEE2E2',
            borderColor: '#C91432'
        },
        Medium: {
            label: 'Maintenance',
            color: '#F97316',
            bgColor: '#FFEDD5',
            borderColor: '#F97316'
        },
        Low: {
            label: 'Low',
            color: '#0078D4',
            bgColor: '#DBEAFE',
            borderColor: '#0078D4'
        }
    };

    //format due date
    const formatDueDate = (task: ITask): string => {
        const date = task.startDate ?? task.expectedEndDate;
        if (!date) return 'No date set';
        
        const now = new Date();
        const diff = date.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (hours < 0) return 'Overdue';
        if (hours < 1) return 'Due in < 1 hour';
        if (hours < 24) return `Due in ${hours} hours`;
        if (days === 1) return 'Due tomorrow';
        return `Due in ${days} days`;
    };

    const formatDate = (dateValue: Date | null): string => {
        if (!dateValue) return 'Not set';
        return dateValue.toLocaleDateString();
    };

    //open record in Power Apps
    const viewRecord = async (task: ITask): Promise<void> => {
        const entityName = task.type === 'Inspection' ? 'apex_inspectionvisit' : 'apex_maintenanceactivity';
        
        try {
            await context.navigation.openForm({ 
                entityName, 
                entityId: task.id 
            });
        } catch (error: unknown) {
            console.error('Error opening record:', error);
        }
    };

    //task Card Component
    const TaskCard: React.FC<{ task: ITask }> = ({ task }) => {
        const config = priorityConfig[task.priority];
        const isCompleted = task.statusCodeFormatted?.toLowerCase().includes('completed') ?? false;
        
        return (
            <div
                className="task-card"
                style={{
                    borderLeftColor: config.borderColor,
                    cursor: 'pointer'
                }}
                onClick={() => setSelectedTask(task)}
            >
                <div className="task-card-header">
                    <div className="task-card-title-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isCompleted ? (
                                <CheckmarkCircle24Filled primaryFill="green" />
                            ) : (
                                <Circle24Regular />
                            )}
                            <span className="task-id">{task.taskId}</span>
                        </div>
                        <span 
                            className="task-type-badge"
                            style={{ 
                                backgroundColor: config.bgColor,
                                color: config.color
                            }}
                        >
                            {task.type}
                        </span>
                    </div>
                    <h3 className="task-name">{task.name}</h3>
                </div>

                <div className="task-card-meta">
                    <div className="task-meta-item">
                        <IconCalendar size={14} />
                        <span>{formatDueDate(task)}</span>
                    </div>
                    <div className="task-meta-item">
                        <IconClock size={14} />
                        <span>{task.status}</span>
                    </div>
                    {task.relatedCaseName && (
                        <div className="task-meta-item">
                            <span style={{ fontSize: '11px', color: '#605e5c' }}>
                                Case: {task.relatedCaseName}
                            </span>
                        </div>
                    )}
                </div>

                {task.description && (
                    <p className="task-description">{task.description}</p>
                )}
            </div>
        );
    };

    //task Detail Modal with more info about a task
    const TaskDetailModal: React.FC<{ task: ITask; onClose: () => void }> = ({ task, onClose }) => {
        const config = priorityConfig[task.priority];
        
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header" style={{ backgroundColor: config.color }}>
                        <h2>Task Details</h2>
                        <button className="modal-close" onClick={onClose}>×</button>
                    </div>

                    <div className="modal-body">

                        <div className="modal-field">
                            <label>Name</label>
                            <p>{task.name}</p>
                        </div>

                        {task.relatedCaseName && (
                            <div className="modal-field">
                                <label>Related Case</label>
                                <p>{task.relatedCaseName}</p>
                            </div>
                        )}

                        <div className="modal-field-row">
                            <div className="modal-field">
                                <label>Type</label>
                                <p>{task.type}</p>
                            </div>

                            <div className="modal-field">
                                <label>Priority</label>
                                <p style={{ color: config.color, fontWeight: 600 }}>{task.priority}</p>
                            </div>
                        </div>

                        <div className="modal-field">
                            <label>Start Date</label>
                            <div className="modal-field-with-icon">
                                <IconCalendar size={16} />
                                <div>
                                    <p>{formatDate(task.startDate)}</p>
                                    <p className="modal-field-subtext">{formatDueDate(task)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="modal-field">
                            <label>Expected End Date</label>
                            <p>{formatDate(task.expectedEndDate ?? task.endDate)}</p>
                        </div>

                        <div className="modal-field">
                            <label>Status</label>
                            <p>{task.status}</p>
                        </div>

                        <div className="modal-field">
                            <label>Assigned To</label>
                            <p>{task.assignedTo}</p>
                        </div>

                        {task.description && (
                            <div className="modal-field">
                                <label>Description</label>
                                <p>{task.description}</p>
                            </div>
                        )}

                        {(task.actualCost ?? task.estimatedCost) && (
                            <div className="modal-field">
                                <label>Cost</label>
                                <p>€{task.actualCost?.toFixed(2) ?? task.estimatedCost?.toFixed(2) ?? '0.00'}</p>
                            </div>
                        )}

                        <button
                            className="modal-action-button"
                            style={{ backgroundColor: config.color }}
                            onClick={() => { void viewRecord(task); }}
                        >
                            <IconExternalLink size={18} />
                            Open Record to Take Action
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    //priority Lane Component
    const PriorityLane: React.FC<{ priority: 'High' | 'Medium' | 'Low'; tasks: ITask[] }> = ({ priority, tasks: laneTasks }) => {
        const config = priorityConfig[priority];
        
        return (
            <div className="priority-lane">
                <div className="lane-header" style={{ backgroundColor: config.color }}>
                    <h2>{config.label}</h2>
                    <span className="lane-count">{laneTasks.length}</span>
                </div>
                <div className="lane-content">
                    {laneTasks.length === 0 ? (
                        <div className="lane-empty">
                            <IconAlertCircle size={32} style={{ opacity: 0.5 }} />
                            <p>No tasks in this priority</p>
                        </div>
                    ) : (
                        laneTasks.map(task => <TaskCard key={task.id} task={task} />)
                    )}
                </div>
            </div>
        );
    };

    //dropdown filter
    const filterOptions: { value: FilterScope; label: string }[] = [
        { value: 'today', label: 'Today' },
        { value: 'next7days', label: 'Next 7 Days' },
        { value: 'all', label: 'All Open' }
    ];

    //loading state
    if (isLoading) {
        return (
            <div className="loading-error-container">
                <Spinner className="loading-error-icon" />
                <span className="loading-text">Loading your priority tasks...</span>
            </div>
        );
    }

    //error state
    if (isError) {
        return (
            <div className="loading-error-container">
                <Circle24Regular className="loading-error-icon" primaryFill="red" style={{ fontSize: '50px' }} />
                <span className="error-text">Something went wrong. Contact your administrator.</span>
            </div>
        );
    }

    //main render with layout: header, 3 priority lanes, optional modal if card is clicked on
    return (
        <div className="priority-tasks-wrapper">
            <div className="priority-tasks-container">

                <div className="priority-tasks-header">
                    <div className="header-top">
                        <h2 className="header-title">My Priority Tasks</h2>

                        <div className="filter-container">
                            <button
                                className="filter-button"
                                onClick={() => setShowFilterMenu(!showFilterMenu)}
                            >
                                <IconFilter size={18} />
                                {filterOptions.find(f => f.value === filterScope)?.label}
                            </button>

                            {showFilterMenu && (
                                <div className="filter-menu">
                                    {filterOptions.map(option => (
                                        <button
                                            key={option.value}
                                            className={`filter-option ${filterScope === option.value ? 'active' : ''}`}
                                            onClick={() => {
                                                setFilterScope(option.value);
                                                setShowFilterMenu(false);
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="header-stats">
                        <span className="stat-item">
                            <span className="stat-dot" style={{ backgroundColor: priorityConfig.High.color }} />
                            {groupedTasks.High.length} Immediate
                        </span>
                        <span className="stat-item">
                            <span className="stat-dot" style={{ backgroundColor: priorityConfig.Medium.color }} />
                            {groupedTasks.Medium.length} Maintenance
                        </span>
                        <span className="stat-item">
                            <span className="stat-dot" style={{ backgroundColor: priorityConfig.Low.color }} />
                            {groupedTasks.Low.length} Low
                        </span>
                    </div>
                </div>

                <div className="priority-board">
                    <PriorityLane priority="High" tasks={groupedTasks.High} />
                    <PriorityLane priority="Medium" tasks={groupedTasks.Medium} />
                    <PriorityLane priority="Low" tasks={groupedTasks.Low} />
                </div>

                {selectedTask && (
                    <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
                )}

                <div style={{
                    padding: '12px 0',
                    fontSize: '11px',
                    color: '#605e5c',
                    fontStyle: 'italic',
                    textAlign: 'center'
                }}>
                    NOTE: Tasks are automatically filtered to show only items assigned to you
                </div>
            </div>
        </div>
    );
};