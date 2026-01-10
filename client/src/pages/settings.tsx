import { useState, useEffect } from "react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, MessageSquare, Loader2, Plus, X } from "lucide-react";
import { useTestDiscord, useSettings, useUpdateSettings, useEntities, useUpdateEntities, type EntitiesConfig, type CategoryConfig } from "@/lib/api";

export default function Settings() {
  const { mutate: testDiscord, isPending: isTestingDiscord } = useTestDiscord();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { mutate: updateSettings, isPending: isSaving } = useUpdateSettings();
  const { data: entities, isLoading: entitiesLoading } = useEntities();
  const { mutate: updateEntities, isPending: isSavingEntities } = useUpdateEntities();

  // Local state for entities (editable)
  const [entitiesData, setEntitiesData] = useState<EntitiesConfig | null>(null);

  // Load entities into local state when fetched
  useEffect(() => {
    if (entities) {
      setEntitiesData(entities);
    }
  }, [entities]);

  // Form state
  const [formData, setFormData] = useState({
    scoring: {
      recency_weight: 0.3,
      engagement_weight: 0.3,
      velocity_weight: 0.2,
      cross_platform_weight: 0.1,
      entity_priority_weight: 0.1,
    },
    limits: {
      max_candidates_per_category: 200,
      top_n_per_category_for_discord: 5,
      min_video_duration_seconds: 60,
      max_video_duration_seconds: 7200,
      min_view_count: 1000,
    },
    discord: {
      enabled: true,
      webhook_url: "",
    },
    automation: {
      auto_run_on_startup: false,
      scheduled_runs_enabled: false,
      scheduled_time: "14:00",
    },
  });

  // Load settings into form when they're fetched
  useEffect(() => {
    if (settings) {
      setFormData({
        scoring: {
          recency_weight: settings.scoring?.recency_weight ?? 0.3,
          engagement_weight: settings.scoring?.engagement_weight ?? 0.3,
          velocity_weight: settings.scoring?.velocity_weight ?? 0.2,
          cross_platform_weight: settings.scoring?.cross_platform_weight ?? 0.1,
          entity_priority_weight: settings.scoring?.entity_priority_weight ?? 0.1,
        },
        limits: {
          max_candidates_per_category: settings.limits?.max_candidates_per_category ?? 200,
          top_n_per_category_for_discord: settings.limits?.top_n_per_category_for_discord ?? 5,
          min_video_duration_seconds: settings.limits?.min_video_duration_seconds ?? 60,
          max_video_duration_seconds: settings.limits?.max_video_duration_seconds ?? 7200,
          min_view_count: settings.limits?.min_view_count ?? 1000,
        },
        discord: {
          enabled: settings.discord?.enabled ?? true,
          webhook_url: settings.discord?.webhook_url ?? "",
        },
        automation: {
          auto_run_on_startup: settings.automation?.auto_run_on_startup ?? false,
          scheduled_runs_enabled: settings.automation?.scheduled_runs_enabled ?? false,
          scheduled_time: settings.automation?.scheduled_time ?? "14:00",
        },
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings(formData);
  };

  const updateScoring = (field: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      scoring: { ...prev.scoring, [field]: value }
    }));
  };

  const updateLimits = (field: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      limits: { ...prev.limits, [field]: value }
    }));
  };

  const updateDiscord = (field: string, value: boolean | string) => {
    setFormData(prev => ({
      ...prev,
      discord: { ...prev.discord, [field]: value }
    }));
  };

  const updateAutomation = (field: string, value: boolean | string) => {
    setFormData(prev => ({
      ...prev,
      automation: { ...prev.automation, [field]: value }
    }));
  };

  // Entity management functions
  const toggleCategory = (category: 'hip_hop' | 'nba' | 'celebrity', enabled: boolean) => {
    if (!entitiesData) return;
    
    setEntitiesData(prev => {
      if (!prev) return prev;
      const newEntities = { ...prev };
      newEntities.categories[category] = {
        ...newEntities.categories[category],
        enabled: enabled
      };
      // Auto-save to database
      updateEntities(newEntities);
      return newEntities;
    });
  };

  const toggleSection = (category: 'hip_hop' | 'nba' | 'celebrity', section: 'enable_entities' | 'enable_entity_trending' | 'enable_channels' | 'enable_category_keywords', enabled: boolean) => {
    if (!entitiesData) return;
    
    setEntitiesData(prev => {
      if (!prev) return prev;
      const newEntities = { ...prev };
      newEntities.categories[category] = {
        ...newEntities.categories[category],
        [section]: enabled
      };
      // Auto-save to database
      updateEntities(newEntities);
      return newEntities;
    });
  };

  const addEntity = (category: 'hip_hop' | 'nba' | 'celebrity', entityName: string) => {
    if (!entityName.trim() || !entitiesData) return;
    
    setEntitiesData(prev => {
      if (!prev) return prev;
      const newEntities = { ...prev };
      const categoryEntities = [...newEntities.categories[category].entities];
      if (!categoryEntities.includes(entityName.trim())) {
        categoryEntities.push(entityName.trim());
        newEntities.categories[category] = {
          ...newEntities.categories[category],
          entities: categoryEntities
        };
        // Auto-save to database
        updateEntities(newEntities);
      }
      return newEntities;
    });
  };

  const removeEntity = (category: 'hip_hop' | 'nba' | 'celebrity', index: number) => {
    if (!entitiesData) return;
    
    setEntitiesData(prev => {
      if (!prev) return prev;
      const newEntities = { ...prev };
      const categoryEntities = [...newEntities.categories[category].entities];
      categoryEntities.splice(index, 1);
      newEntities.categories[category] = {
        ...newEntities.categories[category],
        entities: categoryEntities
      };
      // Auto-save to database
      updateEntities(newEntities);
      return newEntities;
    });
  };

  const addChannel = (category: 'hip_hop' | 'nba' | 'celebrity', channelName: string) => {
    if (!channelName.trim() || !entitiesData) return;
    
    setEntitiesData(prev => {
      if (!prev) return prev;
      const newEntities = { ...prev };
      const categoryChannels = [...newEntities.categories[category].channels];
      if (!categoryChannels.includes(channelName.trim())) {
        categoryChannels.push(channelName.trim());
        newEntities.categories[category] = {
          ...newEntities.categories[category],
          channels: categoryChannels
        };
        // Auto-save to database
        updateEntities(newEntities);
      }
      return newEntities;
    });
  };

  const removeChannel = (category: 'hip_hop' | 'nba' | 'celebrity', index: number) => {
    if (!entitiesData) return;
    
    setEntitiesData(prev => {
      if (!prev) return prev;
      const newEntities = { ...prev };
      const categoryChannels = [...newEntities.categories[category].channels];
      categoryChannels.splice(index, 1);
      newEntities.categories[category] = {
        ...newEntities.categories[category],
        channels: categoryChannels
      };
      // Auto-save to database
      updateEntities(newEntities);
      return newEntities;
    });
  };

  if (settingsLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
       <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-1">Settings</h1>
            <p className="text-muted-foreground text-sm">Manage entities, scoring, and automation settings.</p>
          </div>
          <Button 
            className="bg-primary text-black hover:bg-primary/90"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Save Changes
              </>
            )}
          </Button>
        </div>

        <Tabs defaultValue="entities" className="w-full">
          <TabsList className="w-full h-11 bg-muted/30 rounded-lg p-1 grid grid-cols-3 gap-1">
            <TabsTrigger 
              value="entities" 
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground rounded-md font-medium transition-colors"
            >
              Entities
            </TabsTrigger>
            <TabsTrigger 
              value="scoring"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground rounded-md font-medium transition-colors"
            >
              Scoring
            </TabsTrigger>
            <TabsTrigger 
              value="automation"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground rounded-md font-medium transition-colors"
            >
              Automation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entities" className="mt-6">
            <div className="grid gap-6">
          {/* Entity Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Entity Management</CardTitle>
              <CardDescription>Define which artists, players, and creators to track. Changes are saved to the database.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {entitiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : entitiesData ? (
                <>
                  {/* Hip Hop Category */}
                  <div className="space-y-4 p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">Hip Hop</h3>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground">
                          {entitiesData.categories.hip_hop.enabled ?? true ? 'Enabled' : 'Disabled'}
                        </Label>
                        <Switch
                          checked={entitiesData.categories.hip_hop.enabled ?? true}
                          onCheckedChange={(checked) => toggleCategory('hip_hop', checked)}
                        />
                      </div>
                    </div>
                    
                    {(entitiesData.categories.hip_hop.enabled ?? true) && (
                      <>
                        {/* Section Toggles for Hip Hop */}
                        <div className="space-y-3 p-3 bg-muted/20 rounded-md">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-sm">Entity + Keyword Searches</Label>
                              <p className="text-xs text-muted-foreground">Search for entities combined with keywords (e.g., "Drake interview")</p>
                            </div>
                            <Switch
                              checked={entitiesData.categories.hip_hop.enable_entities ?? true}
                              onCheckedChange={(checked) => toggleSection('hip_hop', 'enable_entities', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-sm">Entity Trending Searches</Label>
                              <p className="text-xs text-muted-foreground">Find trending videos about entities (e.g., "Idris Elba" sorted by views)</p>
                            </div>
                            <Switch
                              checked={entitiesData.categories.hip_hop.enable_entity_trending ?? true}
                              onCheckedChange={(checked) => toggleSection('hip_hop', 'enable_entity_trending', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-sm">Channel + Keyword Searches</Label>
                              <p className="text-xs text-muted-foreground">Search channels combined with keywords (e.g., "VladTV interview")</p>
                            </div>
                            <Switch
                              checked={entitiesData.categories.hip_hop.enable_channels ?? true}
                              onCheckedChange={(checked) => toggleSection('hip_hop', 'enable_channels', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-sm">Category Keyword Searches</Label>
                              <p className="text-xs text-muted-foreground">Find trending content in category (e.g., "hip hop news")</p>
                            </div>
                            <Switch
                              checked={entitiesData.categories.hip_hop.enable_category_keywords ?? true}
                              onCheckedChange={(checked) => toggleSection('hip_hop', 'enable_category_keywords', checked)}
                            />
                          </div>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Entities</Label>
                        <div className="space-y-2">
                          {entitiesData.categories.hip_hop.entities.map((entity, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input value={entity} readOnly className="flex-1" />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEntity('hip_hop', idx)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add entity..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  addEntity('hip_hop', e.currentTarget.value);
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                if (input) {
                                  addEntity('hip_hop', input.value);
                                  input.value = '';
                                }
                              }}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Channels</Label>
                        <div className="space-y-2">
                          {entitiesData.categories.hip_hop.channels.map((channel, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input value={channel} readOnly className="flex-1" />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeChannel('hip_hop', idx)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add channel..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  addChannel('hip_hop', e.currentTarget.value);
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                if (input) {
                                  addChannel('hip_hop', input.value);
                                  input.value = '';
                                }
                              }}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                      </>
                    )}
                  </div>

                  <Separator />

                  {/* NBA Category */}
                  <div className="space-y-4 p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">NBA</h3>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground">
                          {entitiesData.categories.nba.enabled ?? true ? 'Enabled' : 'Disabled'}
                        </Label>
                        <Switch
                          checked={entitiesData.categories.nba.enabled ?? true}
                          onCheckedChange={(checked) => toggleCategory('nba', checked)}
                        />
                      </div>
                    </div>
                    
                    {(entitiesData.categories.nba.enabled ?? true) && (
                      <>
                        {/* Section Toggles for NBA */}
                        <div className="space-y-3 p-3 bg-muted/20 rounded-md">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-sm">Entity + Keyword Searches</Label>
                              <p className="text-xs text-muted-foreground">Search for entities combined with keywords (e.g., "LeBron James interview")</p>
                            </div>
                            <Switch
                              checked={entitiesData.categories.nba.enable_entities ?? true}
                              onCheckedChange={(checked) => toggleSection('nba', 'enable_entities', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-sm">Entity Trending Searches</Label>
                              <p className="text-xs text-muted-foreground">Find trending videos about entities (e.g., "Stephen Curry" sorted by views)</p>
                            </div>
                            <Switch
                              checked={entitiesData.categories.nba.enable_entity_trending ?? true}
                              onCheckedChange={(checked) => toggleSection('nba', 'enable_entity_trending', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-sm">Channel + Keyword Searches</Label>
                              <p className="text-xs text-muted-foreground">Search channels combined with keywords (e.g., "ESPN interview")</p>
                            </div>
                            <Switch
                              checked={entitiesData.categories.nba.enable_channels ?? true}
                              onCheckedChange={(checked) => toggleSection('nba', 'enable_channels', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-sm">Category Keyword Searches</Label>
                              <p className="text-xs text-muted-foreground">Find trending content in category (e.g., "NBA news")</p>
                            </div>
                            <Switch
                              checked={entitiesData.categories.nba.enable_category_keywords ?? true}
                              onCheckedChange={(checked) => toggleSection('nba', 'enable_category_keywords', checked)}
                            />
                          </div>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Entities</Label>
                        <div className="space-y-2">
                          {entitiesData.categories.nba.entities.map((entity, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input value={entity} readOnly className="flex-1" />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEntity('nba', idx)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add entity..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  addEntity('nba', e.currentTarget.value);
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                if (input) {
                                  addEntity('nba', input.value);
                                  input.value = '';
                                }
                              }}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Channels</Label>
                        <div className="space-y-2">
                          {entitiesData.categories.nba.channels.map((channel, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input value={channel} readOnly className="flex-1" />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeChannel('nba', idx)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add channel..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  addChannel('nba', e.currentTarget.value);
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                if (input) {
                                  addChannel('nba', input.value);
                                  input.value = '';
                                }
                              }}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                      </>
                    )}
                  </div>

                  <Separator />

                  {/* Celebrity Category */}
                  <div className="space-y-4 p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">Celebrity</h3>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground">
                          {entitiesData.categories.celebrity.enabled ?? true ? 'Enabled' : 'Disabled'}
                        </Label>
                        <Switch
                          checked={entitiesData.categories.celebrity.enabled ?? true}
                          onCheckedChange={(checked) => toggleCategory('celebrity', checked)}
                        />
                      </div>
                    </div>
                    
                    {(entitiesData.categories.celebrity.enabled ?? true) && (
                      <>
                        {/* Section Toggles for Celebrity */}
                        <div className="space-y-3 p-3 bg-muted/20 rounded-md">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-sm">Entity + Keyword Searches</Label>
                              <p className="text-xs text-muted-foreground">Search for entities combined with keywords (e.g., "Joe Rogan podcast")</p>
                            </div>
                            <Switch
                              checked={entitiesData.categories.celebrity.enable_entities ?? true}
                              onCheckedChange={(checked) => toggleSection('celebrity', 'enable_entities', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-sm">Entity Trending Searches</Label>
                              <p className="text-xs text-muted-foreground">Find trending videos about entities (e.g., "Idris Elba" sorted by views)</p>
                            </div>
                            <Switch
                              checked={entitiesData.categories.celebrity.enable_entity_trending ?? true}
                              onCheckedChange={(checked) => toggleSection('celebrity', 'enable_entity_trending', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-sm">Channel + Keyword Searches</Label>
                              <p className="text-xs text-muted-foreground">Search channels combined with keywords (e.g., "GQ Sports interview")</p>
                            </div>
                            <Switch
                              checked={entitiesData.categories.celebrity.enable_channels ?? true}
                              onCheckedChange={(checked) => toggleSection('celebrity', 'enable_channels', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-sm">Category Keyword Searches</Label>
                              <p className="text-xs text-muted-foreground">Find trending content in category (e.g., "celebrity news")</p>
                            </div>
                            <Switch
                              checked={entitiesData.categories.celebrity.enable_category_keywords ?? true}
                              onCheckedChange={(checked) => toggleSection('celebrity', 'enable_category_keywords', checked)}
                            />
                          </div>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Entities</Label>
                        <div className="space-y-2">
                          {entitiesData.categories.celebrity.entities.map((entity, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input value={entity} readOnly className="flex-1" />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEntity('celebrity', idx)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add entity..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  addEntity('celebrity', e.currentTarget.value);
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                if (input) {
                                  addEntity('celebrity', input.value);
                                  input.value = '';
                                }
                              }}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Channels</Label>
                        <div className="space-y-2">
                          {entitiesData.categories.celebrity.channels.map((channel, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input value={channel} readOnly className="flex-1" />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeChannel('celebrity', idx)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add channel..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  addChannel('celebrity', e.currentTarget.value);
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                if (input) {
                                  addChannel('celebrity', input.value);
                                  input.value = '';
                                }
                              }}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Failed to load entities configuration
                </div>
              )}
            </CardContent>
          </Card>
            </div>
          </TabsContent>

          <TabsContent value="scoring" className="mt-6">
            <div className="grid gap-6">
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
                  <Input 
                    type="number" 
                    value={formData.scoring.recency_weight} 
                    step="0.1" 
                    className="font-mono"
                    onChange={(e) => updateScoring("recency_weight", parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground">Higher = favors newer videos.</p>
                </div>
                <div className="space-y-2">
                  <Label>Engagement Weight</Label>
                  <Input 
                    type="number" 
                    value={formData.scoring.engagement_weight} 
                    step="0.1" 
                    className="font-mono"
                    onChange={(e) => updateScoring("engagement_weight", parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground">Favors high likes/comments.</p>
                </div>
                <div className="space-y-2">
                  <Label>Velocity Weight</Label>
                  <Input 
                    type="number" 
                    value={formData.scoring.velocity_weight} 
                    step="0.1" 
                    className="font-mono"
                    onChange={(e) => updateScoring("velocity_weight", parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground">Favors fast-growing views.</p>
                </div>
                <div className="space-y-2">
                  <Label>Cross-Platform Weight</Label>
                  <Input 
                    type="number" 
                    value={formData.scoring.cross_platform_weight} 
                    step="0.1" 
                    className="font-mono"
                    onChange={(e) => updateScoring("cross_platform_weight", parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground">Favors videos trending elsewhere.</p>
                </div>
                <div className="space-y-2">
                  <Label>Entity Priority Weight</Label>
                  <Input 
                    type="number" 
                    value={formData.scoring.entity_priority_weight} 
                    step="0.1" 
                    className="font-mono"
                    onChange={(e) => updateScoring("entity_priority_weight", parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground">Favors high-priority entities.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Limits Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Limits & Filters</CardTitle>
              <CardDescription>Configure candidate limits and filtering criteria.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label>Max Candidates per Category</Label>
                    <Input 
                      type="number" 
                      value={formData.limits.max_candidates_per_category} 
                      className="font-mono"
                      onChange={(e) => updateLimits("max_candidates_per_category", parseInt(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">Maximum candidates saved per category per scan</p>
                 </div>
                 <div className="space-y-2">
                    <Label>Top N for Discord</Label>
                    <Input 
                      type="number" 
                      value={formData.limits.top_n_per_category_for_discord} 
                      className="font-mono"
                      onChange={(e) => updateLimits("top_n_per_category_for_discord", parseInt(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">Top candidates sent to Discord per category</p>
                 </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label>Min Video Duration (seconds)</Label>
                    <Input 
                      type="number" 
                      value={formData.limits.min_video_duration_seconds} 
                      className="font-mono"
                      onChange={(e) => updateLimits("min_video_duration_seconds", parseInt(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">Minimum video length to consider</p>
                 </div>
                 <div className="space-y-2">
                    <Label>Max Video Duration (seconds)</Label>
                    <Input 
                      type="number" 
                      value={formData.limits.max_video_duration_seconds} 
                      className="font-mono"
                      onChange={(e) => updateLimits("max_video_duration_seconds", parseInt(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">Maximum video length to consider</p>
                 </div>
              </div>
              
              <div className="space-y-2">
                 <Label>Minimum View Count</Label>
                 <Input 
                   type="number" 
                   value={formData.limits.min_view_count} 
                   className="font-mono"
                   onChange={(e) => updateLimits("min_view_count", parseInt(e.target.value) || 0)}
                 />
                 <p className="text-xs text-muted-foreground">Only consider videos with at least this many views (default: 1000)</p>
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
                <Switch 
                  checked={formData.discord.enabled}
                  onCheckedChange={(checked) => updateDiscord("enabled", checked)}
                />
              </div>
              
              <div className="space-y-2">
                 <Label>Webhook URL</Label>
                 <Input 
                   type="password" 
                   value={formData.discord.webhook_url || ""} 
                   placeholder="https://discord.com/api/webhooks/..."
                   className="font-mono"
                   onChange={(e) => updateDiscord("webhook_url", e.target.value)}
                 />
                 <p className="text-xs text-muted-foreground">
                   Discord webhook URL for notifications. Leave empty to use environment variable.
                 </p>
              </div>

              <div className="pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => testDiscord()}
                  disabled={isTestingDiscord}
                  className="w-full"
                >
                  {isTestingDiscord ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Test Discord Notification
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Send a test message to verify your Discord webhook is working.
                </p>
              </div>
            </CardContent>
          </Card>
            </div>
          </TabsContent>

          <TabsContent value="automation" className="mt-6">
            <div className="grid gap-6">
          {/* Automation Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Automation</CardTitle>
              <CardDescription>Configure automatic scanning and scheduled runs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-base">Auto Run on Startup</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically run a scan when the application starts (applies to production builds).
                  </p>
                </div>
                <Switch 
                  checked={formData.automation.auto_run_on_startup}
                  onCheckedChange={(checked) => updateAutomation('auto_run_on_startup', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-base">Scheduled Runs</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable scheduled scans at a specific time each day. The backend will track and execute runs automatically.
                  </p>
                </div>
                <Switch 
                  checked={formData.automation.scheduled_runs_enabled}
                  onCheckedChange={(checked) => updateAutomation('scheduled_runs_enabled', checked)}
                />
              </div>

              {formData.automation.scheduled_runs_enabled && (
                <div className="space-y-2 p-4 border border-border rounded-lg">
                  <Label>Scheduled Time (24-hour format)</Label>
                  <Input
                    type="time"
                    value={formData.automation.scheduled_time}
                    onChange={(e) => updateAutomation('scheduled_time', e.target.value)}
                    className="font-mono w-32"
                    step="60"
                  />
                  <p className="text-xs text-muted-foreground">
                    The scan will run at this time each day (server timezone). Format: HH:MM (e.g., 14:00 for 2:00 PM).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
            </div>
          </TabsContent>
        </Tabs>
       </div>
    </Layout>
  );
}
