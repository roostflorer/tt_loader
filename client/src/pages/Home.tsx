import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  Download, 
  Zap, 
  ShieldCheck, 
  CheckCircle2, 
  PlayCircle,
  Clock,
  LayoutDashboard
} from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100 }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">TeleLoad Bot</span>
          </div>
          
          <nav className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/admin">
              <Button variant="ghost" className="hidden sm:flex items-center gap-2 hover:bg-primary/5 hover:text-primary">
                <LayoutDashboard className="w-4 h-4" />
                Admin
              </Button>
            </Link>
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 rounded-full px-6">
              Open Telegram
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative pt-24 pb-32 overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
            <div className="absolute top-20 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-30 animate-pulse" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/20 rounded-full blur-3xl opacity-30" />
          </div>

          <div className="container mx-auto px-4 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="outline" className="mb-6 px-4 py-1.5 rounded-full border-primary/30 text-primary bg-primary/5">
                <Zap className="w-3.5 h-3.5 mr-2 fill-current" />
                Now with 24h Free Trial
              </Badge>
              
              <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight mb-6 leading-tight">
                Download Telegram Videos <br />
                <span className="text-gradient">Without Limits</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                The most powerful bot to save content from private channels and groups. No watermarks, high speed, and completely anonymous.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/30 transition-all hover:-translate-y-1">
                  <PlayCircle className="w-5 h-5 mr-2" />
                  Start Bot Now
                </Button>
                <Link href="/admin">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 px-8 rounded-2xl border-2 hover:bg-muted/50">
                    View Dashboard
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              <motion.div variants={itemVariants}>
                <Card className="h-full border-none shadow-lg bg-card/50 backdrop-blur hover:bg-card transition-colors duration-300">
                  <CardHeader>
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
                      <Download className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-xl">Free Downloads</CardTitle>
                    <CardDescription>Get started instantly without paying.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      <li className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        5 downloads per day
                      </li>
                      <li className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Includes watermark
                      </li>
                      <li className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Standard speed
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="h-full border-2 border-primary/20 shadow-xl shadow-primary/10 bg-card relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-xl">POPULAR</div>
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
                      <Clock className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-xl">24h Free Trial</CardTitle>
                    <CardDescription>Experience the full power for free.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      <li className="flex items-center gap-2 text-sm text-foreground font-medium">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        Unlimited downloads
                      </li>
                      <li className="flex items-center gap-2 text-sm text-foreground font-medium">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        No watermarks
                      </li>
                      <li className="flex items-center gap-2 text-sm text-foreground font-medium">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        Valid for 24 hours
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="h-full border-none shadow-lg bg-card/50 backdrop-blur hover:bg-card transition-colors duration-300">
                  <CardHeader>
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-xl">PRO Access</CardTitle>
                    <CardDescription>For power users who need the best.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      <li className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Unlimited everything
                      </li>
                      <li className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Priority support
                      </li>
                      <li className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        High-speed servers
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-12 bg-muted/10">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p className="mb-4">&copy; 2024 Telegram Video Downloader Bot. All rights reserved.</p>
          <div className="flex justify-center gap-6 text-sm">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-primary transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
