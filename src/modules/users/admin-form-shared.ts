import { field } from "../../http/params";
import type { AdminPermissionInput } from "./user.service";

export const DEFAULT_ADD_ADMIN_PERMISSIONS: AdminPermissionInput = {
  is_superadmin: true,
  can_delete: false,
  can_view_performance: false,
  can_view_counsellor_work: false,
  can_manage_settings: false,
};

export function permissionInput(data: Record<string, unknown>): AdminPermissionInput {
  const on = (name: string) => field(data, name) === "on";
  return {
    is_superadmin: on("is_superadmin"),
    can_delete: on("can_delete"),
    can_view_performance: on("can_view_performance"),
    can_view_counsellor_work: on("can_view_counsellor_work"),
    can_manage_settings: on("can_manage_settings"),
  };
}

function checked(on: boolean): string {
  return on ? " checked" : "";
}

export function permissionMarkup(values: AdminPermissionInput): string {
  return `<hr><h5><i class="fas fa-shield-alt"></i> Permissions</h5>
<div class="form-group"><div class="custom-control custom-switch">
<input type="checkbox" class="custom-control-input" id="is_superadmin" name="is_superadmin"${checked(values.is_superadmin)}>
<label class="custom-control-label" for="is_superadmin"><strong>Super Admin</strong> (full access)</label>
</div></div>
<div id="permission-fields"${values.is_superadmin ? ' style="display:none;"' : ""}>
<div class="form-group"><div class="custom-control custom-switch">
<input type="checkbox" class="custom-control-input" id="can_delete" name="can_delete"${checked(values.can_delete)}>
<label class="custom-control-label" for="can_delete">Can delete records</label>
</div></div>
<div class="form-group"><div class="custom-control custom-switch">
<input type="checkbox" class="custom-control-input" id="can_manage_settings" name="can_manage_settings"${checked(values.can_manage_settings)}>
<label class="custom-control-label" for="can_manage_settings">Can manage settings (sources, statuses, etc.)</label>
</div></div>
<div class="form-group"><div class="custom-control custom-switch">
<input type="checkbox" class="custom-control-input" id="can_view_performance" name="can_view_performance"${checked(values.can_view_performance)}>
<label class="custom-control-label" for="can_view_performance">Can view counsellor performance</label>
</div></div>
<div class="form-group"><div class="custom-control custom-switch">
<input type="checkbox" class="custom-control-input" id="can_view_counsellor_work" name="can_view_counsellor_work"${checked(values.can_view_counsellor_work)}>
<label class="custom-control-label" for="can_view_counsellor_work">Can view counsellor work <small class="text-muted">(superadmin only)</small></label>
</div></div>
</div>`;
}
