"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { UserRole } from "@/lib/constants";
import type { ProductTypeConfig } from "@/lib/types/product-types";
import { DEFAULT_PRODUCT_TYPES } from "@/lib/types/product-types";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  pin: string | null;
  active: number;
  department?: string | null;
}

interface UserFormProps {
  user?: UserData | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserForm({ user, onClose, onSuccess }: UserFormProps) {
  const isEditing = !!user;

  const [productTypes, setProductTypes] = useState<ProductTypeConfig[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // Parse existing department JSON into selected type keys
  const parseDeptTypes = (dept: string | null | undefined): string[] => {
    if (!dept) return [];
    try {
      return JSON.parse(dept);
    } catch {
      return [];
    }
  };

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    role: user?.role || "cashier",
    pin: user?.pin || "",
    department: user?.department || "",
    selectedTypes: parseDeptTypes(user?.department),
    active: user?.active ?? 1,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setFormData({
        name: "",
        email: "",
        password: "",
        role: "cashier",
        pin: "",
        department: "",
        selectedTypes: [],
        active: 1,
      });
      return;
    }
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      pin: user.pin || "",
      department: user.department || "",
      selectedTypes: parseDeptTypes(user.department),
      active: user.active ?? 1,
    });
  }, [user]);

  // Fetch available product types
  useEffect(() => {
    if (formData.role === "department_staff" && productTypes.length === 0) {
      setTypesLoading(true);
      fetch("/api/settings")
        .then((r) => r.json())
        .then((result) => {
          if (result.success && result.data?.productTypes?.length) {
            setProductTypes(result.data.productTypes);
          } else {
            setProductTypes(DEFAULT_PRODUCT_TYPES);
          }
        })
        .catch(() => setProductTypes(DEFAULT_PRODUCT_TYPES))
        .finally(() => setTypesLoading(false));
    }
  }, [formData.role, productTypes.length]);

  const toggleType = (key: string) => {
    setFormData((prev) => {
      const current = prev.selectedTypes || [];
      const next = current.includes(key)
        ? current.filter((t) => t !== key)
        : [...current, key];
      return {
        ...prev,
        selectedTypes: next,
        department: next.length > 0 ? JSON.stringify(next) : "",
      };
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (formData.role === "department_staff" && (formData.selectedTypes || []).length === 0) {
        setError("Select at least one product type for department staff");
        setIsLoading(false);
        return;
      }

      const url = isEditing ? `/api/users/${user.id}` : "/api/users";
      const method = isEditing ? "PUT" : "POST";

      const departmentValue =
        formData.role === "department_staff" && formData.selectedTypes.length > 0
          ? JSON.stringify(formData.selectedTypes)
          : null;

      const payload: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        pin: formData.pin || null,
        department: departmentValue,
      };

      if (formData.password) {
        payload.password = formData.password;
      } else if (!isEditing) {
        setError("Password is required for new users");
        setIsLoading(false);
        return;
      }

      if (isEditing) {
        payload.active = formData.active;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.message || "Operation failed");
        setIsLoading(false);
        return;
      }

      onSuccess();
    } catch {
      setError("An error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="John Doe"
            required
            disabled={isLoading}
            className="focus-visible:ring-[#1c6a1e]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="john@example.com"
            required
            disabled={isLoading}
            className="focus-visible:ring-[#1c6a1e]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            {isEditing ? "Password (leave blank to keep current)" : "Password"}
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            required={!isEditing}
            disabled={isLoading}
            className="focus-visible:ring-[#1c6a1e]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select
            value={formData.role}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                role: value as UserRole,
                ...(value !== "department_staff"
                  ? { selectedTypes: [], department: "" }
                  : {}),
              }))
            }
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="cashier">Cashier</SelectItem>
              <SelectItem value="department_staff">Department Staff</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Admins can manage stock, purchases, and reports. Cashiers can only
            sell. Department staff can prepare orders and manage inventory but
            cannot process payments.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pin">PIN (4 digits, for quick POS login)</Label>
          <Input
            id="pin"
            name="pin"
            value={formData.pin}
            onChange={handleChange}
            placeholder="1234"
            maxLength={4}
            pattern="\d{4}"
            disabled={isLoading}
            className="focus-visible:ring-[#1c6a1e]"
          />
        </div>

        {isEditing && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active === 1}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  active: e.target.checked ? 1 : 0,
                }))
              }
              className="h-4 w-4"
              disabled={isLoading}
            />
            <Label htmlFor="active">Active</Label>
          </div>
        )}

        {formData.role === "department_staff" && (
          <div className="space-y-2">
            <Label>Product Types (Departments)</Label>
            <p className="text-xs text-muted-foreground">
              Select the product types this staff member can access. They will
              only see items matching the selected types.
            </p>
            {typesLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading product types...
              </div>
            ) : productTypes.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">
                No product types configured. Configure them in Settings.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {productTypes.map((type) => {
                  const isSelected = (formData.selectedTypes || []).includes(
                    type.key,
                  );
                  return (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => toggleType(type.key)}
                      disabled={isLoading}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-left text-sm font-medium transition-all ${
                        isSelected
                          ? "border-[#1c6a1e] bg-[#1c6a1e]/10 text-[#1c6a1e] dark:text-[#2a8a30]"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-base">{type.emoji}</span>
                      <span>{type.label}</span>
                      {isSelected && (
                        <span className="ml-auto text-[#1c6a1e]">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {(formData.selectedTypes || []).length > 0 && (
              <p className="text-xs text-slate-500">
                {formData.selectedTypes.length} type
                {formData.selectedTypes.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-[#1c6a1e] hover:bg-[#2a8a30] text-white font-semibold shadow-md shadow-[#1c6a1e]/20"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? "Updating..." : "Creating..."}
              </>
            ) : isEditing ? (
              "Update User"
            ) : (
              "Create User"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
