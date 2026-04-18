import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  features?: string[];
}

export function ModulePlaceholder({ title, description, features }: Props) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Construction className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Coming in next phase</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              This module is part of the phased rollout. We'll wire it up next.
            </p>
          </div>
          {features && features.length > 0 && (
            <ul className="mx-auto max-w-md space-y-1.5 text-left text-sm">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
