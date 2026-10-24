import { PERMISSIONS } from '@/entities/admin-account/model/permissions';

import type { AuditAction, AuditActorRole, AuditOperation, AuditUsedPermission } from './types';

/** 출결 그룹(detail.group)마다 쓰는 권한 이름. HOST는 담당 그룹 권한으로 입력한다. */
const GROUP_PERMISSIONS: Readonly<
  Record<string, { manage: string; entry: string; ownEntry: string }>
> = {
  STUDY: {
    manage: 'ATTENDANCE_STUDY_WRITE',
    entry: 'ATTENDANCE_STUDY_ENTRY_WRITE',
    ownEntry: 'ATTENDANCE_STUDY_ENTRY_OWN_GROUP_WRITE',
  },
  ADV: {
    manage: 'ATTENDANCE_ADV_WRITE',
    entry: 'ATTENDANCE_ADV_ENTRY_WRITE',
    ownEntry: 'ATTENDANCE_ADV_ENTRY_OWN_GROUP_WRITE',
  },
  BASE: {
    manage: 'ATTENDANCE_BASE_WRITE',
    entry: 'ATTENDANCE_BASE_WRITE',
    ownEntry: 'ATTENDANCE_BASE_WRITE',
  },
};

interface ActionPermissionInput {
  action: AuditAction;
  detail: Readonly<Record<string, unknown>> | null;
  actorId: number | null;
  actorRole: AuditActorRole | null;
  targetIds: readonly string[];
}

/** 액션 하나가 권한 매트릭스의 어느 권한으로 한 일이고, 그 권한 안에서 생성·수정·삭제 중 무엇인지. */
interface ActionPermission {
  key: string | null;
  operation: AuditOperation;
}

const isSelfTarget = ({ actorId, targetIds }: ActionPermissionInput) =>
  actorId !== null && targetIds.length === 1 && targetIds[0] === String(actorId);

/** 액션별 권한 이름과 생성·수정·삭제 구분. 권한 매트릭스에 항목이 없는 작업(동아리원·반기 관리)은 key가 null이다. */
function actionPermission(input: ActionPermissionInput): ActionPermission {
  const group = typeof input.detail?.group === 'string' ? input.detail.group : null;
  const groupKeys = group ? GROUP_PERMISSIONS[group] : undefined;
  const isHost = input.actorRole === 'HOST';
  const accountWrite = isSelfTarget(input) ? 'ADMIN_ACCOUNT_SELF_WRITE' : 'ADMIN_ACCOUNT_WRITE';

  switch (input.action) {
    case 'ADMIN_ACCOUNT_CREATE':
    case 'ADMIN_ID_ISSUE':
      return { key: 'ADMIN_ACCOUNT_CREATE_DELETE', operation: 'CREATE' };
    case 'ADMIN_ACCOUNT_UPDATE':
    case 'ADMIN_PASSWORD_RESET':
      return { key: accountWrite, operation: 'UPDATE' };
    case 'ADMIN_ACCOUNT_DELETE':
      return { key: 'ADMIN_ACCOUNT_CREATE_DELETE', operation: 'DELETE' };
    case 'PERMISSION_CHANGE':
      return { key: 'ADMIN_PERMISSION_WRITE', operation: 'UPDATE' };
    case 'OPERATOR_TEAM_SET':
      return { key: 'ADMIN_ACCOUNT_CREATE_DELETE', operation: 'UPDATE' };
    case 'OPERATOR_ASSIGN':
      return {
        key: 'ADMIN_ACCOUNT_CREATE_DELETE',
        operation: typeof input.detail?.teamName === 'string' ? 'CREATE' : 'DELETE',
      };
    case 'HOST_ACCOUNT_CREATE':
      return { key: 'HOST_ACCOUNT_WRITE', operation: 'CREATE' };
    case 'HOST_ACCOUNT_UPDATE':
      return { key: 'HOST_ACCOUNT_WRITE', operation: 'UPDATE' };
    case 'HOST_ACCOUNT_DELETE':
      return { key: 'HOST_ACCOUNT_WRITE', operation: 'DELETE' };

    case 'MEMBER_CREATE':
      return { key: null, operation: 'CREATE' };
    case 'MEMBER_UPDATE':
      return { key: null, operation: 'UPDATE' };
    case 'MEMBER_DELETE':
      // 행을 지우지 않고 활동 상태만 탈퇴로 바꾸므로 수정이다.
      return { key: null, operation: 'UPDATE' };

    case 'ATTENDANCE_EDIT':
      return {
        key: groupKeys ? (isHost ? groupKeys.ownEntry : groupKeys.manage) : null,
        operation: 'UPDATE',
      };
    case 'ATTENDANCE_SUBMIT':
      return {
        key: groupKeys ? (isHost ? groupKeys.ownEntry : groupKeys.entry) : null,
        operation: 'UPDATE',
      };
    case 'EVENT_CREATE':
      return { key: 'ATTENDANCE_EVENT_WRITE', operation: 'CREATE' };
    case 'EVENT_UPDATE':
    case 'EVENT_ATTENDEES_UPDATE':
      return { key: 'ATTENDANCE_EVENT_WRITE', operation: 'UPDATE' };
    case 'EVENT_DELETE':
      return { key: 'ATTENDANCE_EVENT_WRITE', operation: 'DELETE' };
    case 'SCORE_RULE_CREATE':
      return { key: 'SCORE_RULE_WRITE', operation: 'CREATE' };
    case 'SCORE_RULE_UPDATE':
    case 'SCORE_RULE_ACTIVATE':
      return { key: 'SCORE_RULE_WRITE', operation: 'UPDATE' };
    case 'SCORE_RULE_DELETE':
      return { key: 'SCORE_RULE_WRITE', operation: 'DELETE' };
    case 'SEMESTER_CREATE':
      return { key: null, operation: 'CREATE' };
    case 'SEMESTER_UPDATE':
    case 'SEMESTER_MEMBERS_SET':
    case 'SEMESTER_WEEK_UPDATE':
    case 'SEMESTER_WEEK_DATES':
      return { key: null, operation: 'UPDATE' };

    case 'TEAM_CREATE':
    case 'TEAM_MEMBER_ADD':
      return { key: groupKeys?.manage ?? null, operation: 'CREATE' };
    case 'TEAM_UPDATE':
      return { key: groupKeys?.manage ?? null, operation: 'UPDATE' };
    case 'TEAM_DELETE':
    case 'TEAM_MEMBER_REMOVE':
      return { key: groupKeys?.manage ?? null, operation: 'DELETE' };

    case 'CONTENT_CREATE':
      return { key: 'CONTENT_WRITE', operation: 'CREATE' };
    case 'CONTENT_UPDATE':
      return { key: 'CONTENT_WRITE', operation: 'UPDATE' };
    case 'CONTENT_DELETE':
      return { key: 'CONTENT_WRITE', operation: 'DELETE' };

    case 'RECRUITMENT_CREATE':
      return { key: 'RECRUITMENT_NOTICE_WRITE', operation: 'CREATE' };
    case 'RECRUITMENT_UPDATE':
    case 'RECRUITMENT_CLOSE':
      return { key: 'RECRUITMENT_NOTICE_WRITE', operation: 'UPDATE' };

    case 'DECISION_CONFIRM':
      return { key: 'FINAL_DECISION_WRITE', operation: 'UPDATE' };
    case 'PROMOTION':
      return { key: 'MEMBER_PROMOTION_WRITE', operation: 'CREATE' };
    case 'APPLICATION_DELETE':
      return { key: 'APPLICATION_DELETE_ALL', operation: 'DELETE' };
  }
}

/** 기록 한 줄이 쓴 권한(권한 매트릭스의 항목 이름)과 생성·수정·삭제 구분. */
export function usedPermissionOf(input: ActionPermissionInput): {
  permission: AuditUsedPermission | null;
  operation: AuditOperation;
} {
  const { key, operation } = actionPermission(input);
  const definition = key ? PERMISSIONS.find((permission) => permission.key === key) : undefined;
  return {
    permission: definition ? { key: definition.key, label: definition.label } : null,
    operation,
  };
}
