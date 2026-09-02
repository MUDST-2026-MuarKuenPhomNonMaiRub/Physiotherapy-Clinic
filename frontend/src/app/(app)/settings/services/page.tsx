"use client";

import { useState } from "react";
import { ClipboardList, Pencil, Plus, Ticket } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CourseTemplate, Service, ServiceType } from "@/types";
import { toast } from "sonner";

const emptyServiceForm = { name: "", type: "SINGLE_VISIT" as ServiceType, price: 0, duration: 30 };
const emptyCourseForm = { name: "", description: "", price: 0, sessions: 10, bonusSessions: 0, expiryDays: 180 };

export default function ServicesSettingsPage() {
  const services = useClinicStore((s) => s.services);
  const courseTemplates = useClinicStore((s) => s.courseTemplates);
  const addService = useClinicStore((s) => s.addService);
  const updateService = useClinicStore((s) => s.updateService);
  const toggleServiceStatus = useClinicStore((s) => s.toggleServiceStatus);
  const addCourseTemplate = useClinicStore((s) => s.addCourseTemplate);
  const updateCourseTemplate = useClinicStore((s) => s.updateCourseTemplate);
  const toggleCourseTemplateStatus = useClinicStore((s) => s.toggleCourseTemplateStatus);

  const [serviceOpen, setServiceOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);

  const [courseOpen, setCourseOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseTemplate | null>(null);
  const [courseForm, setCourseForm] = useState(emptyCourseForm);

  function openCreateService() { setEditingService(null); setServiceForm(emptyServiceForm); setServiceOpen(true); }
  function openEditService(s: Service) {
    setEditingService(s); setServiceForm({ name: s.name, type: s.type, price: s.price, duration: s.duration }); setServiceOpen(true);
  }
  async function saveService() {
    if (!serviceForm.name) return;
    try {
      if (editingService) { await updateService(editingService.id, serviceForm); toast.success("Service updated"); }
      else { await addService({ ...serviceForm, status: "ACTIVE" }); toast.success("Service created"); }
      setServiceOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the change");
    }
  }

  async function toggleStatus(action: Promise<void>) {
    try {
      await action;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the status");
    }
  }

  function openCreateCourse() { setEditingCourse(null); setCourseForm(emptyCourseForm); setCourseOpen(true); }
  function openEditCourse(c: CourseTemplate) {
    setEditingCourse(c);
    setCourseForm({ name: c.name, description: c.description, price: c.price, sessions: c.sessions, bonusSessions: c.bonusSessions, expiryDays: c.expiryDays });
    setCourseOpen(true);
  }
  async function saveCourse() {
    if (!courseForm.name) return;
    try {
      if (editingCourse) { await updateCourseTemplate(editingCourse.id, courseForm); toast.success("Course updated"); }
      else { await addCourseTemplate({ ...courseForm, status: "ACTIVE" }); toast.success("Course created"); }
      setCourseOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the change");
    }
  }

  return (
    <>
      <PageHeader title="Services / Courses" description="Configure billable services and course packages sold at checkout" />

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <div className="mb-3 flex justify-end">
            <Button onClick={openCreateService}><Plus className="h-4 w-4" /> Add Service</Button>
          </div>
          {services.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No services yet" description="Add a service to make it available at checkout." action={<Button onClick={openCreateService}>Add Service</Button>} />
          ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s) => (
                    <TableRow key={s.id} className="[&>td]:py-3.5">
                      <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            s.type === "ASSESSMENT"
                              ? "border-info/20 bg-info/10 text-info"
                              : "border-primary/20 bg-primary/10 text-primary"
                          }`}
                        >
                          {s.type === "ASSESSMENT" ? "Assessment" : "Single Visit"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-mono text-sm font-semibold text-foreground">
                          {formatCurrency(s.price)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.duration} min</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditService(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Switch checked={s.status === "ACTIVE"} onCheckedChange={() => void toggleStatus(toggleServiceStatus(s.id))} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          )}
        </TabsContent>

        <TabsContent value="courses">
          <div className="mb-3 flex justify-end">
            <Button onClick={openCreateCourse}><Plus className="h-4 w-4" /> Add Course</Button>
          </div>
          {courseTemplates.length === 0 ? (
            <EmptyState icon={Ticket} title="No courses yet" description="Add a course package to make it available for purchase at checkout." action={<Button onClick={openCreateCourse}>Add Course</Button>} />
          ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseTemplates.map((c) => (
                    <TableRow key={c.id} className="[&>td]:py-3.5">
                      <TableCell>
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.description}</p>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-mono text-sm font-semibold text-foreground">
                          {formatCurrency(c.price)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.sessions}</TableCell>
                      <TableCell className="text-muted-foreground">{c.bonusSessions > 0 ? `+${c.bonusSessions}` : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.expiryDays} days</TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCourse(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Switch checked={c.status === "ACTIVE"} onCheckedChange={() => void toggleStatus(toggleCourseTemplateStatus(c.id))} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={serviceOpen} onOpenChange={setServiceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingService ? "Edit Service" : "Add Service"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Service Name</Label>
              <Input value={serviceForm.name} onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Service Type</Label>
              <Select value={serviceForm.type} onValueChange={(v) => setServiceForm((f) => ({ ...f, type: v as ServiceType }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSESSMENT">Assessment</SelectItem>
                  <SelectItem value="SINGLE_VISIT">Single Visit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price (THB)</Label>
                <Input type="number" value={serviceForm.price} onChange={(e) => setServiceForm((f) => ({ ...f, price: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={serviceForm.duration} onChange={(e) => setServiceForm((f) => ({ ...f, duration: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceOpen(false)}>Cancel</Button>
            <Button disabled={!serviceForm.name} onClick={saveService}>{editingService ? "Save Changes" : "Add Service"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={courseOpen} onOpenChange={setCourseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCourse ? "Edit Course" : "Add Course"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Course Name</Label>
              <Input value={courseForm.name} onChange={(e) => setCourseForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={courseForm.description} onChange={(e) => setCourseForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price (THB)</Label>
                <Input type="number" value={courseForm.price} onChange={(e) => setCourseForm((f) => ({ ...f, price: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Number of Sessions</Label>
                <Input type="number" value={courseForm.sessions} onChange={(e) => setCourseForm((f) => ({ ...f, sessions: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Bonus Sessions</Label>
                <Input type="number" value={courseForm.bonusSessions} onChange={(e) => setCourseForm((f) => ({ ...f, bonusSessions: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry (days)</Label>
                <Input type="number" value={courseForm.expiryDays} onChange={(e) => setCourseForm((f) => ({ ...f, expiryDays: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseOpen(false)}>Cancel</Button>
            <Button disabled={!courseForm.name} onClick={saveCourse}>{editingCourse ? "Save Changes" : "Add Course"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
