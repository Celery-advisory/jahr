import { cache } from "react";
import { cookies } from "next/headers";
import { AUTH_BYPASS } from "@/lib/auth/config";
import { DUMMY_PROFILE } from "@/lib/auth/dummy-profile";
import {
  permissionTagsFromRows,
  type PermissionTagRow,
  type PermissionTagSlug,
} from "@/lib/auth/permissions";
import { createClient } from "@/utils/supabase/server";
import { firstRelation } from "@/utils/supabase/relations";
import type { Profile, ProfileWithOrg } from "@/lib/types/database";

/**
 * `profile_permission_tags` has two foreign keys to `profiles` (`profile_id`
 * and `assigned_by`), so the embed must name the constraint to stay valid.
 */
export const PERMISSION_TAGS_EMBED =
  "profile_permission_tags!profile_permission_tags_profile_id_fkey ( tag:permission_tags ( slug ) )";

/**
 * `manager:manager_id` is the person this profile reports to.
 * `profiles!manager_id` is the reverse side (their direct reports) and comes
 * back as an empty array when they have none, which drops the manager email.
 */
const CURRENT_PROFILE_SELECT = `
  *,
  business_unit:business_units ( id, name, slug ),
  department:departments ( id, name, slug ),
  manager:manager_id ( id, first_name, last_name, email, job_title ),
  ${PERMISSION_TAGS_EMBED}
`;

interface CurrentProfileRow extends Profile {
  business_unit: ProfileWithOrg["business_unit"] | ProfileWithOrg["business_unit"][];
  department: ProfileWithOrg["department"] | ProfileWithOrg["department"][];
  manager: ProfileWithOrg["manager"] | ProfileWithOrg["manager"][];
  profile_permission_tags: PermissionTagRow[] | null;
}

async function loadProfileTags(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
): Promise<PermissionTagSlug[]> {
  const { data, error } = await supabase
    .from("profile_permission_tags")
    .select("tag:permission_tags(slug)")
    .eq("profile_id", profileId);

  if (error) {
    console.error("[getCurrentProfile] tags", error.message);
    return [];
  }

  return permissionTagsFromRows(data);
}

export const getCurrentProfile = cache(async (): Promise<ProfileWithOrg | null> => {
  if (AUTH_BYPASS) {
    return DUMMY_PROFILE;
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Middleware already refreshed and verified the session on this request.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (!userId) {
    return null;
  }

  const [profileResult, reportsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(CURRENT_PROFILE_SELECT)
      .eq("id", userId)
      .maybeSingle<CurrentProfileRow>(),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("manager_id", userId)
      .eq("status", "active"),
  ]);

  if (profileResult.error) {
    console.error("[getCurrentProfile]", profileResult.error.message);
    return null;
  }

  if (!profileResult.data) {
    return null;
  }

  const {
    business_unit,
    department,
    manager,
    profile_permission_tags,
    ...profile
  } = profileResult.data;

  return {
    ...profile,
    business_unit: firstRelation(business_unit),
    department: firstRelation(department),
    manager: firstRelation(manager),
    isManager: (reportsResult.count ?? 0) > 0,
    tags: permissionTagsFromRows(profile_permission_tags),
  };
});

export { loadProfileTags };
