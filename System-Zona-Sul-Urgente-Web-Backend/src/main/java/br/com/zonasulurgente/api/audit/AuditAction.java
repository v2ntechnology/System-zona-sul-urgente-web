package br.com.zonasulurgente.api.audit;

/**
 * Ações auditadas (ARCHITECTURE §15, mais as de acesso e equipe). Espelho do CHECK de
 * audit_logs.action (V9): ação nova entra nos dois.
 */
public enum AuditAction {
	CREATE, UPDATE, PUBLISH, UNPUBLISH, DELETE, RESTORE,
	LOGIN, LOGIN_FAILED, LOGOUT, MFA_SETUP, MFA_RESET,
	ROLE_CHANGE, INVITE, INVITE_ACCEPT, ACTIVATE, DEACTIVATE, MERGE,
	INSTAGRAM_IMPORT, AI_GENERATION, IGNORE
}
