import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";

export default function Settings() {
  return (
    <Layout>
       <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-1">Configuration</h1>
            <p className="text-muted-foreground text-sm">Manage entities, scoring weights, and notification settings.</p>
          </div>
          <Button className="bg-primary text-black hover:bg-primary/90">
            <Save className="w-4 h-4 mr-2" /> Save Changes
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Entity Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Entity Management (entities.yaml)</CardTitle>
              <CardDescription>Define which artists, players, and creators to track.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Hip Hop Entities</Label>
                  <Textarea 
                    className="font-mono text-xs h-32 bg-muted/50 border-border"
                    defaultValue={`- "Drake"\n- "Kendrick Lamar"\n- "Travis Scott"\n- "Future"\n- "Nicki Minaj"`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hip Hop Channels</Label>
                  <Textarea 
                    className="font-mono text-xs h-32 bg-muted/50 border-border"
                    defaultValue={`- "VladTV"\n- "Drink Champs"\n- "Million Dollaz Worth Of Game"\n- "No Jumper"`}
                  />
                </div>
              </div>
              
              <Separator />
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>NBA Entities</Label>
                  <Textarea 
                    className="font-mono text-xs h-32 bg-muted/50 border-border"
                    defaultValue={`- "LeBron James"\n- "Stephen Curry"\n- "Kevin Durant"\n- "Victor Wembanyama"`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>NBA Channels</Label>
                  <Textarea 
                    className="font-mono text-xs h-32 bg-muted/50 border-border"
                    defaultValue={`- "NBA"\n- "House of Highlights"\n- "All The Smoke"`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scoring Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Scoring Algorithm (settings.yaml)</CardTitle>
              <CardDescription>Adjust the weights used to calculate the "Clip Potential" score.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Recency Weight</Label>
                  <Input type="number" defaultValue="0.3" step="0.1" className="font-mono" />
                  <p className="text-[10px] text-muted-foreground">Higher = favors newer videos.</p>
                </div>
                <div className="space-y-2">
                  <Label>Engagement Weight</Label>
                  <Input type="number" defaultValue="0.3" step="0.1" className="font-mono" />
                  <p className="text-[10px] text-muted-foreground">Favors high likes/comments.</p>
                </div>
                <div className="space-y-2">
                  <Label>Velocity Weight</Label>
                  <Input type="number" defaultValue="0.2" step="0.1" className="font-mono" />
                  <p className="text-[10px] text-muted-foreground">Favors fast-growing views.</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                 <div className="space-y-0.5">
                    <Label>Time Window</Label>
                    <p className="text-xs text-muted-foreground">Only scan videos published within this window.</p>
                 </div>
                 <div className="w-32">
                    <Input defaultValue="72" className="font-mono text-right" />
                 </div>
              </div>
            </CardContent>
          </Card>

          {/* Discord Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Manage Discord webhook alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Discord Alerts</Label>
                  <p className="text-xs text-muted-foreground">Send daily summary to the configured webhook.</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="space-y-2">
                 <Label>Webhook URL</Label>
                 <Input type="password" value="https://discord.com/api/webhooks/..." className="font-mono text-muted-foreground" readOnly />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label>Max Candidates per Category</Label>
                    <Input type="number" defaultValue="200" className="font-mono" />
                 </div>
                 <div className="space-y-2">
                    <Label>Top N for Discord</Label>
                    <Input type="number" defaultValue="5" className="font-mono" />
                 </div>
              </div>
            </CardContent>
          </Card>
        </div>
       </div>
    </Layout>
  );
}
