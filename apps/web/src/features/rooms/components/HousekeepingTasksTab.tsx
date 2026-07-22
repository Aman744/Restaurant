import React, { useState, useEffect } from 'react';
import type { HousekeepingTask, Room } from '@restaurant-qr/core';
import { useToast } from '../../../components/shared/ToastContext';
import { Sparkles, Play, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { db } from '../../../lib/firebase.js';
import { doc, deleteDoc } from 'firebase/firestore';
import { RoomStayRepository } from '@restaurant-qr/infra';

interface HousekeepingTasksTabProps {
  tenantId: string;
  isMockMode: boolean;
}

export const HousekeepingTasksTab: React.FC<HousekeepingTasksTabProps> = ({ tenantId, isMockMode }) => {
  const toast = useToast();
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      if (isMockMode) {
        const stored = localStorage.getItem('restaurant_qr_mock_housekeeping_tasks_db');
        setTasks(stored ? JSON.parse(stored) : []);
      } else {
        const repo = new RoomStayRepository(db);
        const list = await repo.listHousekeepingTasks(tenantId);
        setTasks(list);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, [tenantId, isMockMode]);

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this service request?')) {
      return;
    }

    if (isMockMode) {
      const stored = localStorage.getItem('restaurant_qr_mock_housekeeping_tasks_db');
      if (stored) {
        try {
          const list: HousekeepingTask[] = JSON.parse(stored);
          const updated = list.filter((t) => t.id !== taskId);
          localStorage.setItem('restaurant_qr_mock_housekeeping_tasks_db', JSON.stringify(updated));
          toast.success('Service request deleted!');
          fetchTasks();
          window.dispatchEvent(new Event('storage'));
        } catch (e) {
          toast.error('Failed to delete task from local storage');
        }
      }
    } else {
      try {
        await deleteDoc(doc(db, 'tenants', tenantId, 'housekeeping_tasks', taskId));
        toast.success('Service request deleted!');
        fetchTasks();
      } catch (err: any) {
        console.error('Delete failed:', err);
        toast.error(`Failed to delete service request: ${err.message}`);
      }
    }
  };

  const updateTaskStatus = async (task: HousekeepingTask, newStatus: HousekeepingTask['status']) => {
    let tasksList: HousekeepingTask[] = [];
    const now = new Date();

    if (isMockMode) {
      const stored = localStorage.getItem('restaurant_qr_mock_housekeeping_tasks_db');
      if (stored) {
        tasksList = JSON.parse(stored);
        const idx = tasksList.findIndex((t) => t.id === task.id);
        if (idx !== -1) {
          tasksList[idx].status = newStatus;
          if (newStatus === 'completed') {
            tasksList[idx].completedAt = now;
          }
          localStorage.setItem('restaurant_qr_mock_housekeeping_tasks_db', JSON.stringify(tasksList));
        }
      }

      // Update room status
      const roomsStored = localStorage.getItem('restaurant_qr_mock_rooms_db');
      if (roomsStored) {
        const rooms: Room[] = JSON.parse(roomsStored);
        const idx = rooms.findIndex((r) => r.id === task.roomId);
        if (idx !== -1) {
          if (newStatus === 'in-progress') {
            rooms[idx].status = 'cleaning';
          } else if (newStatus === 'completed') {
            rooms[idx].status = 'inspection';
          } else if (newStatus === 'verified' || newStatus === 'closed') {
            rooms[idx].status = 'available';
          }
          localStorage.setItem('restaurant_qr_mock_rooms_db', JSON.stringify(rooms));
        }
      }

      toast.success(`Task status updated to ${newStatus}!`);
      fetchTasks();
      window.dispatchEvent(new Event('storage'));
    } else {
      try {
        const repo = new RoomStayRepository(db);
        const updatedTask = {
          ...task,
          status: newStatus,
          completedAt: newStatus === 'completed' ? now : task.completedAt
        };
        await repo.saveHousekeepingTask(tenantId, updatedTask);
        toast.success(`Task status updated to ${newStatus}!`);
        fetchTasks();
      } catch (err: any) {
        toast.error(`Failed to update task: ${err.message}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-400 text-xs font-semibold">
        Loading housekeeping tasks...
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => t.status !== 'verified' && t.status !== 'closed');
  const closedTasks = tasks.filter((t) => t.status === 'verified' || t.status === 'closed');

  const renderTaskCard = (task: HousekeepingTask) => (
    <div key={task.id} className="border border-zinc-800 bg-zinc-900/60 p-5 rounded-2xl space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-white">Room {task.roomNumber}</h3>
            {task.taskType && task.taskType !== 'cleaning' && (
              <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                Service Request
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-400">{task.roomName}</p>
        </div>
        <div className="flex items-center gap-2">
          {task.taskType && task.taskType !== 'cleaning' && (
            <button
              onClick={() => handleDeleteTask(task.id)}
              className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
              title="Delete Service Request"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
            task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            task.status === 'in-progress' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' :
            task.status === 'verified' || task.status === 'closed' ? 'bg-zinc-850 text-zinc-400 border-zinc-700' :
            'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
          }`}>
            {task.status}
          </span>
        </div>
      </div>

      {/* Service Type badge */}
      {task.taskType && (
        <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
          {task.taskType === 'laundry' ? '👕 Laundry' :
           task.taskType === 'amenity' ? '🧴 Amenity' :
           task.taskType === 'concierge' ? '🚗 Concierge' :
           task.taskType === 'wellness' ? '🧘 Wellness' :
           task.taskType === 'convenience' ? '☎️ Convenience' :
           task.taskType === 'waiter' ? '🙋 Call Waiter' :
           '🧹 Room Cleaning'}
        </div>
      )}

      {/* Service details notes callout */}
      {task.notes && (
        <div className="p-3 bg-zinc-950/80 border border-zinc-850 text-zinc-300 text-xs rounded-xl font-sans leading-relaxed">
          <strong>Notes:</strong> {task.notes}
        </div>
      )}

      <div className="space-y-1.5 font-mono text-[9px] text-zinc-500">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          CREATED: {new Date(task.createdAt).toLocaleString()}
        </div>
        {task.completedAt && (
          <div className="flex items-center gap-1.5 text-emerald-500/70">
            <CheckCircle2 className="h-3.5 w-3.5" />
            COMPLETED: {new Date(task.completedAt).toLocaleString()}
          </div>
        )}
      </div>

      <div className="pt-2 flex gap-2">
        {task.status === 'pending' && (
          <button
            onClick={() => updateTaskStatus(task, 'in-progress')}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-black" />
            {task.taskType && task.taskType !== 'cleaning' ? 'Start Processing' : 'Start Cleaning'}
          </button>
        )}
        {task.status === 'in-progress' && (
          <button
            onClick={() => updateTaskStatus(task, 'completed')}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {task.taskType && task.taskType !== 'cleaning' ? 'Mark Completed' : 'Mark Sanitized'}
          </button>
        )}
        {task.status === 'completed' && (
          <button
            onClick={() => updateTaskStatus(task, 'verified')}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {task.taskType && task.taskType !== 'cleaning' ? 'Close Request' : 'Approve Inspection'}
          </button>
        )}
        {(task.status === 'verified' || task.status === 'closed') && (
          <div className="w-full py-2 bg-zinc-800 border border-zinc-700 text-zinc-400 text-center text-xs font-bold rounded-xl">
            Request Completed & Closed
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-base font-extrabold text-white">Housekeeping & Service Requests</h2>
          <p className="text-xs text-zinc-400">Manage room cleanings, inspector reviews, and guest service requests.</p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-3xl p-12 text-center text-zinc-500 text-xs font-medium space-y-2">
          <Sparkles className="h-6 w-6 text-zinc-600 mx-auto" />
          <p>No housekeeping or service tasks found.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Tasks Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-zinc-900/60 pb-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Active Housekeeping & Services ({activeTasks.length})</span>
            </div>
            {activeTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeTasks.map((task) => renderTaskCard(task))}
              </div>
            ) : (
              <div className="border border-dashed border-zinc-850 bg-zinc-950/20 py-8 text-center text-zinc-500 rounded-3xl">
                <p className="text-xs font-medium text-zinc-500">No active housekeeping or service tasks</p>
              </div>
            )}
          </div>

          {/* Completed & Closed Tasks Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-zinc-900/60 pb-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Housekeeping Tasks Completed & Closed ({closedTasks.length})</span>
            </div>
            {closedTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80 hover:opacity-100 transition duration-200">
                {closedTasks.map((task) => renderTaskCard(task))}
              </div>
            ) : (
              <div className="border border-dashed border-zinc-850 bg-zinc-950/20 py-8 text-center text-zinc-500 rounded-3xl">
                <p className="text-xs font-medium text-zinc-500">No completed or closed tasks found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
