import { Label } from "@/components/ui/label";
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";

export default function CheckboxLabel({
                                        text,
                                        checked,
                                        setChecked,
                                        disabled = false
                                      }: {
  text: string;
  checked: boolean;
  setChecked: React.Dispatch<React.SetStateAction<boolean>>;
  disabled: boolean;
}) {
  const handleClick = () => {
    if (!disabled) {
      setChecked((prev) => !prev);
    }
  };

  return (
    <div
      className="flex items-center space-x-2 cursor-pointer"
      role="button"
      tabIndex={0}
    >
      <Checkbox
        id={"gif"}
        checked={checked}
        onCheckedChange={handleClick}
        disabled={disabled}
      />
      <Label onClick={handleClick} htmlFor={"gif"} className="cursor-pointer">
        {text}
      </Label>
    </div>
  );
}