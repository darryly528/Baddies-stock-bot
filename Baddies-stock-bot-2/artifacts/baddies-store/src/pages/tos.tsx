import { motion } from "framer-motion";
import { Link } from "wouter";
import { Shield, AlertTriangle, HandCoins, Scale, MessageSquare, Lock } from "lucide-react";

const EFFECTIVE_DATE = "June 21, 2025";

const sections = [
  {
    icon: AlertTriangle,
    iconColor: "text-amber-400",
    title: "No Liability for Scams",
    content: [
      "Baddies Store is a listing platform only. We do not guarantee, verify, or take responsibility for transactions conducted between buyers and sellers.",
      "By using this platform you acknowledge that peer-to-peer trades carry inherent risk. Baddies Store and its staff are not liable for any loss of in-game items, Robux, or real-world currency resulting from a scam or failed trade.",
      "We strongly recommend using our Middleman service for all trades to reduce your risk.",
    ],
  },
  {
    icon: HandCoins,
    iconColor: "text-primary",
    title: "Middleman Service",
    content: [
      "Baddies Store offers an optional Middleman (MM) service to facilitate safe trades between buyers and sellers.",
      "A fee of 15% of the total trade value is charged for Middleman services. This fee is non-refundable once the Middleman has facilitated the trade.",
      "The Middleman will hold items or payment in escrow until both parties confirm the trade is complete. Baddies Store staff will never ask you to send items or funds without a formal Middleman session open.",
      "To request a Middleman, open a ticket in our Discord server. Impersonating a Middleman is a bannable offence.",
    ],
  },
  {
    icon: Scale,
    iconColor: "text-blue-400",
    title: "Platform Rules",
    content: [
      "All listings must be for legitimate in-game items. Fraudulent, misleading, or duplicate listings will be removed without notice.",
      "You must be the rightful owner of the items you list. Listing items you do not own or have permission to sell is prohibited.",
      "Prices must reflect a genuine offer. Bait-and-switch pricing, price manipulation, and scam listings are strictly prohibited and may result in a permanent ban.",
      "Baddies Store reserves the right to remove any listing and suspend any user at any time for any reason.",
    ],
  },
  {
    icon: MessageSquare,
    iconColor: "text-secondary",
    title: "Disputes",
    content: [
      "If you believe you have been scammed, open a support ticket in our Discord immediately with evidence (screenshots, video). We will investigate and take action where possible.",
      "While we will make reasonable efforts to assist, Baddies Store cannot recover lost items or currency on your behalf. Our ability to act is limited to banning bad actors from the platform.",
      "Chargebacks or disputes filed against Baddies Store for peer-to-peer trade losses will not be honoured, as we are not a party to those transactions.",
    ],
  },
  {
    icon: Lock,
    iconColor: "text-purple-400",
    title: "Privacy & Communications",
    content: [
      "Baddies Store is not responsible for any personal information you choose to share with other users through this platform, our Discord server, or any associated communication channels.",
      "Any conversations, messages, or exchanges that take place between users — including those conducted privately or via third-party services — are entirely at your own risk. We are not liable for the content of those conversations or any consequences arising from them.",
      "We are not responsible for any leakage, exposure, or misuse of personal information that results from your interactions with other users on or off this platform.",
      "We strongly advise against sharing sensitive personal information (such as your real name, address, phone number, or payment credentials) with other users.",
      "Inappropriate, harassing, or harmful communications reported to us may result in account suspension, but Baddies Store cannot be held liable for conduct that occurs outside of our direct control.",
    ],
  },
  {
    icon: Shield,
    iconColor: "text-green-400",
    title: "Acceptance",
    content: [
      "By accessing or using Baddies Store you confirm that you have read, understood, and agree to these Terms of Service.",
      "These terms may be updated at any time. Continued use of the platform after changes are posted constitutes acceptance of the revised terms.",
      `These Terms of Service were last updated on ${EFFECTIVE_DATE}.`,
    ],
  },
];

export default function TosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-primary" />
            </div>
            <h1 className="font-display font-extrabold text-2xl md:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              Terms of Service
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mb-10 pl-[52px]">
            Effective {EFFECTIVE_DATE} — Please read carefully before using Baddies Store.
          </p>

          <div className="space-y-6">
            {sections.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.35 }}
                  className="glass-panel border border-white/10 rounded-2xl p-5 md:p-6"
                >
                  <div className="flex items-center gap-2.5 mb-4">
                    <Icon className={`w-4.5 h-4.5 shrink-0 ${s.iconColor}`} />
                    <h2 className="font-bold text-white text-base">{s.title}</h2>
                  </div>
                  <ul className="space-y-3">
                    {s.content.map((line, j) => (
                      <li key={j} className="flex gap-2.5 text-sm text-muted-foreground leading-relaxed">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
            >
              ← Back to Catalog
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
