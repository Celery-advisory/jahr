"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  removeProfilePhoto,
  updateProfileSettings,
  uploadProfilePhoto,
} from "@/lib/profile/actions";
import { displayName } from "@/lib/types/database";
import type { EmployeeProfile } from "@/lib/types/employee";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import { cn } from "@/lib/utils";
import { useResetOnChange } from "@/lib/hooks/use-reset-on-change";

function emptyValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "-";
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function SettingsForm({ profile }: { profile: EmployeeProfile }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pending, run: runSave } = useAsyncAction();
  const { pending: photoPending, run: runPhoto } = useAsyncAction();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile.first_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [preferredName, setPreferredName] = useState(
    profile.preferred_name ?? "",
  );
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [personalEmail, setPersonalEmail] = useState(
    profile.personal_email ?? "",
  );
  const [addressLine, setAddressLine] = useState(profile.address_line ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [country, setCountry] = useState(profile.country || "Ghana");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useResetOnChange([profile], () => {
    setFirstName(profile.first_name);
    setLastName(profile.last_name);
    setPreferredName(profile.preferred_name ?? "");
    setPhone(profile.phone ?? "");
    setPersonalEmail(profile.personal_email ?? "");
    setAddressLine(profile.address_line ?? "");
    setCity(profile.city ?? "");
    setCountry(profile.country || "Ghana");
  });

  const name = displayName({
    first_name: firstName,
    last_name: lastName,
    preferred_name: preferredName || null,
  });

  const displayNameValue = displayName(profile);

  function resetForm() {
    setFirstName(profile.first_name);
    setLastName(profile.last_name);
    setPreferredName(profile.preferred_name ?? "");
    setPhone(profile.phone ?? "");
    setPersonalEmail(profile.personal_email ?? "");
    setAddressLine(profile.address_line ?? "");
    setCity(profile.city ?? "");
    setCountry(profile.country || "Ghana");
    setError(null);
    setSaved(false);
  }

  function handleCancel() {
    resetForm();
    setEditing(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    void runSave(async () => {
      const result = await updateProfileSettings({
        firstName,
        lastName,
        preferredName,
        phone,
        personalEmail,
        addressLine,
        city,
        country,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setEditing(false);
      router.refresh();
    });
  }

  function handlePhotoUpload(file: File | null) {
    if (!file) return;
    setError(null);
    setSaved(false);
    const formData = new FormData();
    formData.set("file", file);
    void runPhoto(async () => {
      const result = await uploadProfilePhoto(formData);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handlePhotoDelete() {
    setError(null);
    setSaved(false);
    void runPhoto(async () => {
      const result = await removeProfilePhoto();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const busy = pending || photoPending;

  if (!editing) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-end">
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>

        <section className="space-y-5 border-b border-border pb-8">
          <h2 className="text-sm font-medium">Your photo</h2>
          <div className="flex items-center gap-4">
            <UserAvatar
              name={displayNameValue}
              src={profile.avatar_url}
              gender={profile.gender}
              className="size-16"
            />
            <p className="text-sm text-muted-foreground">
              Shown on your profile across JA Group TMS.
            </p>
          </div>
        </section>

        <section className="space-y-5 border-b border-border pb-8">
          <h2 className="text-sm font-medium">Contact</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <ReadOnlyField label="First name" value={profile.first_name} />
            <ReadOnlyField label="Last name" value={profile.last_name} />
            <ReadOnlyField
              label="Preferred name"
              value={emptyValue(profile.preferred_name)}
            />
            <ReadOnlyField label="Work email" value={profile.email} />
            <ReadOnlyField
              label="Personal email"
              value={emptyValue(profile.personal_email)}
            />
            <ReadOnlyField label="Phone" value={emptyValue(profile.phone)} />
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-sm font-medium">Address</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <ReadOnlyField
              label="Street address"
              value={emptyValue(profile.address_line)}
            />
            <ReadOnlyField label="City" value={emptyValue(profile.city)} />
            <ReadOnlyField
              label="Country"
              value={emptyValue(profile.country || "Ghana")}
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-6 border-b border-border pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">Your photo</h2>
          </div>
          <div className="flex items-center gap-4">
            <UserAvatar
              name={name}
              src={profile.avatar_url}
              gender={profile.gender}
              className="size-16"
            />
            <div className="flex items-center gap-3 text-sm">
              {profile.avatar_url ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handlePhotoDelete}
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Delete
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 font-medium text-accent-blue transition-colors hover:underline disabled:opacity-50"
              >
                {photoPending ? <Spinner className="size-3.5" /> : null}
                {profile.avatar_url ? "Update" : "Upload"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  handlePhotoUpload(event.target.files?.[0] ?? null);
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5 border-b border-border pb-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="settings-first-name"
            label="First name"
            value={firstName}
            onChange={setFirstName}
            disabled={busy}
          />
          <Field
            id="settings-last-name"
            label="Last name"
            value={lastName}
            onChange={setLastName}
            disabled={busy}
          />
        </div>

        <Field
          id="settings-preferred-name"
          label="Preferred name"
          value={preferredName}
          onChange={setPreferredName}
          disabled={busy}
        />

        <Field
          id="settings-work-email"
          label="Work email"
          value={profile.email}
          disabled
          readOnly
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="settings-personal-email"
            label="Personal email"
            type="email"
            value={personalEmail}
            onChange={setPersonalEmail}
            disabled={busy}
          />
          <Field
            id="settings-phone"
            label="Phone"
            type="tel"
            value={phone}
            onChange={setPhone}
            disabled={busy}
          />
        </div>
      </section>

      <section className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Address</h2>
          <p className="text-sm text-muted-foreground">
            Used for employment records and emergency contact context.
          </p>
        </div>

        <Field
          id="settings-address"
          label="Street address"
          value={addressLine}
          onChange={setAddressLine}
          disabled={busy}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="settings-city"
            label="City"
            value={city}
            onChange={setCity}
            disabled={busy}
          />
          <Field
            id="settings-country"
            label="Country"
            value={country}
            onChange={setCountry}
            disabled={busy}
          />
        </div>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved && !error ? (
        <p className="text-sm text-success">Your changes have been saved.</p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-border pt-6">
        <Button type="button" variant="outline" onClick={handleCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={busy || !firstName.trim() || !lastName.trim()}
          className="gap-2"
        >
          {pending ? <Spinner /> : null}
          Save changes
        </Button>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  disabled,
  readOnly,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  disabled?: boolean;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
        className={cn(readOnly && "bg-secondary text-muted-foreground")}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
