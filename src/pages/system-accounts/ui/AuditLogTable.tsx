import type { AdminAuditLog } from '@/entities/admin-account/model/types';
import { ACTION_LABELS, formatDateTime } from '@/pages/system-accounts/ui/accountLabels';
import { ROW_CLASS, TABLE_BOX, TD_CLASS, TH_CLASS } from '@/pages/system-accounts/ui/systemStyles';

/** 보안 감사 로그 표(최신 기록부터). */
export function AuditLogTable({ logs }: { logs: readonly AdminAuditLog[] }) {
  return (
    <div className={TABLE_BOX}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-xs">
          <thead className="bg-slate-50/80">
            <tr className="h-11 divide-x divide-slate-200 border-b border-slate-200 text-[11px]">
              <th className={`${TH_CLASS} w-[140px]`}>일시</th>
              <th className={`${TH_CLASS} w-[150px]`}>수행자</th>
              <th className={`${TH_CLASS} w-[110px]`}>작업</th>
              <th className={`${TH_CLASS} w-[200px]`}>대상</th>
              <th className={`${TH_CLASS} text-left`}>내용</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-400">
                  아직 기록이 없습니다.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className={ROW_CLASS}>
                  <td className={`${TD_CLASS} tabular-nums text-slate-500`}>
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className={`${TD_CLASS} font-semibold text-slate-900`}>{log.actor}</td>
                  <td className={TD_CLASS}>
                    <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {ACTION_LABELS[log.actionType]}
                    </span>
                  </td>
                  <td className={`${TD_CLASS} text-slate-700`}>{log.target}</td>
                  <td className="px-4 py-2 text-slate-600">{log.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
