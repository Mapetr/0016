import { Label } from "@/components/ui/label";
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";

export default function CheckboxLabel({ text, setChecked, disabled = false }: {
  text: string,
  setChecked: React.Dispatch<React.SetStateAction<boolean>>,
  disabled: boolean
}) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox id={"gif"} onCheckedChange={(checked) => setChecked(checked === "indeterminate" ? false : checked)}
                disabled={disabled} />
      <Label htmlFor={"gif"}>{text}</Label>
    </div>
  );
}