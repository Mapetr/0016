import { Label } from "@/components/ui/label";
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";

export default function CheckboxLabel({
  id,
  text,
  checked,
  setChecked,
  disabled = false,
}: {
  id: string;
  text: string;
  checked: boolean;
  setChecked: React.Dispatch<React.SetStateAction<boolean>>;
  disabled: boolean;
}) {
  const handleClick = (event: React.MouseEvent<never>) => {
    event.preventDefault();
    if (!disabled) {
      setChecked((prev) => !prev);
    }
  };

  return (
    <div
      className="flex cursor-pointer items-center space-x-3"
      role="button"
      tabIndex={0}
    >
      <Checkbox
        id={id}
        checked={checked}
        onClick={handleClick}
        disabled={disabled}
        className="h-5 w-5 sm:h-4 sm:w-4"
      />
      <Label
        onClick={handleClick}
        htmlFor={id}
        className="cursor-pointer text-base sm:text-sm"
      >
        {text}
      </Label>
    </div>
  );
}
