import React from "react";
import { useStats, useUsers, useDownloadsActivity } from "@/hooks/use-dashboard";
import { Link } from "wouter";
import { 
  Users, 
  DownloadCloud, 
  Crown, 
  Activity, 
  Search,
  ArrowLeft,
  MoreHorizontal,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<"overview" | "users" | "subscriptions">("overview");

  const handleTogglePro = async (telegramId: string, currentIsPro: boolean) => {
    try {
      await apiRequest("POST", `/api/users/${telegramId}/pro`, {
        isPro: !currentIsPro,
        durationDays: !currentIsPro ? 30 : undefined
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: !currentIsPro ? "Subscription Granted" : "Subscription Revoked",
        description: `Successfully updated status for user ${telegramId}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { y: 10, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  const { data: downloadsActivity, isLoading: downloadsLoading } = useDownloadsActivity(7);

  const defaultChartData = [
    { name: 'Mon', downloads: 120 },
    { name: 'Tue', downloads: 250 },
    { name: 'Wed', downloads: 180 },
    { name: 'Thu', downloads: 300 },
    { name: 'Fri', downloads: 450 },
    { name: 'Sat', downloads: 380 },
    { name: 'Sun', downloads: 510 },
  ];

  const chartData = (downloadsActivity && downloadsActivity.length > 0)
    ? downloadsActivity.map(u => ({ name: u.username ? `@${u.username}` : (u.firstName || u.telegramId), downloads: u.downloads }))
    : defaultChartData;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-muted/10 p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-primary/10 p-1.5 rounded-lg">
              <DownloadCloud className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display font-bold text-lg">Admin Panel</span>
          </div>

          <nav className="flex-1 space-y-2">
            <Button 
              variant={activeTab === "overview" ? "secondary" : "ghost"} 
              className={`w-full justify-start font-medium ${activeTab === "overview" ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("overview")}
            >
              <Activity className="w-4 h-4 mr-2" />
              Overview
            </Button>
            <Button 
              variant={activeTab === "users" ? "secondary" : "ghost"} 
              className={`w-full justify-start font-medium ${activeTab === "users" ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("users")}
            >
              <Users className="w-4 h-4 mr-2" />
              Users
            </Button>
            <Button 
              variant={activeTab === "subscriptions" ? "secondary" : "ghost"} 
              className={`w-full justify-start font-medium ${activeTab === "subscriptions" ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("subscriptions")}
            >
              <Crown className="w-4 h-4 mr-2" />
              Subscriptions
            </Button>
          </nav>

          <div className="mt-auto">
            <Link href="/">
              <Button variant="outline" className="w-full gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-display font-bold">
                  {activeTab === "overview" ? "Dashboard" : activeTab === "users" ? "User Management" : "Subscriptions"}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {activeTab === "overview" ? "Welcome back, Administrator" : `Manage your application ${activeTab}`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search users..." 
                    className="pl-9 w-64 bg-background border-border/60"
                  />
                </div>
                <Button 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => {
                    const data = Array.isArray(users) ? users : [];
                    const csvContent = "data:text/csv;charset=utf-8," + data.map((u: any) => `${u.telegramId},${u.username},${u.isPro}`).join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "report.csv");
                    document.body.appendChild(link);
                    link.click();
                  }}
                >
                  Export Report
                </Button>
              </div>
            </div>

            {activeTab === "overview" && (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {statsLoading ? (
                    Array(4).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                    ))
                  ) : (
                    <>
                      <StatsCard 
                        title="Total Users" 
                        value={stats?.totalUsers || 0} 
                        icon={Users} 
                        trend="+12% from last week"
                        color="text-blue-500"
                        bgColor="bg-blue-500/10"
                      />
                      <StatsCard 
                        title="PRO Subscribers" 
                        value={stats?.proUsers || 0} 
                        icon={Crown} 
                        trend="+5% new today"
                        color="text-yellow-500"
                        bgColor="bg-yellow-500/10"
                      />
                      <StatsCard 
                        title="Total Downloads" 
                        value={stats?.totalDownloads || 0} 
                        icon={DownloadCloud} 
                        trend="+28% spike"
                        color="text-green-500"
                        bgColor="bg-green-500/10"
                      />
                      <StatsCard 
                        title="Active Trials" 
                        value={stats?.activeTrials || 0} 
                        icon={Activity} 
                        trend="Currently active"
                        color="text-purple-500"
                        bgColor="bg-purple-500/10"
                      />
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Chart Section */}
                  <Card className="lg:col-span-2 border-none shadow-lg bg-card/50 backdrop-blur">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium">Download Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--popover))', 
                              borderRadius: '8px', 
                              border: '1px solid hsl(var(--border))' 
                            }}
                            cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                          />
                          <Bar 
                            dataKey="downloads" 
                            fill="hsl(var(--primary))" 
                            radius={[4, 4, 0, 0]} 
                            barSize={40}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Quick Actions / Info */}
                  <Card className="border-none shadow-lg bg-primary text-primary-foreground overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    
                    <CardHeader>
                      <CardTitle className="text-xl font-bold">Pro Tips</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 relative z-10">
                      <p className="opacity-90 leading-relaxed">
                        Most users upgrade to PRO after their 3rd download. Consider extending the trial period to increase conversion.
                      </p>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm font-medium opacity-80">
                          <span>Server Load</span>
                          <span>32%</span>
                        </div>
                        <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white w-[32%] rounded-full" />
                        </div>
                      </div>

                      <Button variant="secondary" className="w-full mt-4 bg-white text-primary hover:bg-white/90">
                        Manage Settings
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {(activeTab === "users" || activeTab === "overview" || activeTab === "subscriptions") && (
              /* Users Table */
              <Card className="border-none shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">
                    {activeTab === "subscriptions" ? "Active Subscriptions" : "User List"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="space-y-2">
                      {Array(5).fill(0).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>User</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Registered</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(Array.isArray(users) ? users : [])
                            .filter((u: any) => activeTab === "subscriptions" ? u.isPro : true)
                            .map((user: any) => (
                            <motion.tr 
                              key={user.id}
                              variants={itemVariants}
                              className="group hover:bg-muted/30 transition-colors"
                            >
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span className="text-foreground">{user.firstName || 'Unknown'}</span>
                                  <span className="text-xs text-muted-foreground">@{user.username || 'no_username'}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {user.isPro ? (
                                  <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 border-none">
                                    PRO
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                    Free
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="z-50 min-w-[8rem] bg-popover p-1 shadow-md border rounded-md">
                                      <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">Actions</DropdownMenuLabel>
                                      <DropdownMenuItem className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => handleTogglePro(user.telegramId, user.isPro!)}
                                        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                      >
                                        {user.isPro ? (
                                          <div className="flex items-center text-destructive">
                                            <XCircle className="w-4 h-4 mr-2" />
                                            Revoke PRO
                                          </div>
                                        ) : (
                                          <div className="flex items-center text-green-500">
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Grant PRO (30d)
                                          </div>
                                        )}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground text-destructive">
                                        Ban User
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </motion.tr>
                          ))}
                        </TableBody>
                      </Table>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, trend, color, bgColor }: any) {
  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-2 rounded-xl ${bgColor} ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${bgColor} ${color}`}>
            {trend}
          </span>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <div className="text-2xl font-bold mt-1 font-display">{value.toLocaleString()}</div>
        </div>
      </CardContent>
    </Card>
  );
}
