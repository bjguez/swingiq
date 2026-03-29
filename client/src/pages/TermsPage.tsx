import Layout from "@/components/Layout";

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-foreground mb-3">{num}. {title}</h2>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1 ml-2">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

export default function TermsPage() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-10 px-4">
        <div className="mb-10">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">swingstudio.ai</p>
          <h1 className="font-display font-bold text-4xl tracking-tight mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Effective Date: March 28, 2026</p>
        </div>

        <p className="text-sm font-semibold text-foreground mb-8 leading-relaxed">
          PLEASE READ THESE TERMS CAREFULLY BEFORE USING SWINGSTUDIO. BY ACCESSING OR USING THE PLATFORM, YOU AGREE TO BE BOUND BY THESE TERMS. IF YOU DO NOT AGREE, DO NOT USE THE PLATFORM.
        </p>

        <Section num="1" title="Acceptance of Terms">
          <p>These Terms of Service ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") and SwingStudio ("SwingStudio," "we," "us," or "our"), a sole proprietorship operated by its owner, governing your access to and use of the SwingStudio platform, website, mobile application, and all related services (collectively, the "Platform").</p>
          <p>By creating an account, accessing, or using the Platform in any manner, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. These Terms apply to all users, including coaches, players, parents, guardians, and any other individuals accessing the Platform.</p>
        </Section>

        <Section num="2" title="Eligibility and Minor Users">
          <p>You must be at least 13 years of age to use the Platform. By using the Platform, you represent and warrant that you meet this minimum age requirement.</p>
          <p>If you are under the age of 18, your parent or legal guardian must review and agree to these Terms on your behalf. By allowing a minor to use the Platform, a parent or guardian agrees to these Terms and accepts full responsibility for the minor's use of the Platform and any consequences arising therefrom.</p>
          <p>Coaches and organizations who create accounts on behalf of or that include minor athletes represent and warrant that they have obtained all necessary parental or guardian consents required by applicable law, including without limitation the Children's Online Privacy Protection Act ("COPPA"). SwingStudio disclaims all liability for any failure to obtain required consents.</p>
        </Section>

        <Section num="3" title="Description of Services">
          <p>SwingStudio provides an AI-powered baseball swing analysis platform that allows users to upload video content and receive automated analytical feedback. Services may include:</p>
          <BulletList items={[
            "Video upload, storage, and analysis",
            "AI-generated swing mechanics feedback",
            "Comparison of user swings against reference data",
            "Progress tracking and longitudinal performance data",
            "Coach-to-player communication and feedback tools",
            "Subscription-based and free-tier access tiers",
          ]} />
          <p>SwingStudio reserves the right to modify, suspend, or discontinue any feature or aspect of the Platform at any time, with or without notice, and without liability to you.</p>
        </Section>

        <Section num="4" title="User Accounts">
          <p>To access certain features, you must create an account. You agree to:</p>
          <BulletList items={[
            "Provide accurate, current, and complete information during registration",
            "Maintain and promptly update your account information",
            "Keep your login credentials confidential and secure",
            "Accept responsibility for all activity that occurs under your account",
            "Notify us immediately of any unauthorized use of your account",
          ]} />
          <p>SwingStudio reserves the right to suspend or terminate any account at its sole discretion. You may not transfer your account to any third party.</p>
        </Section>

        <Section num="5" title="User Content and Video Submissions">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">5.1 Your Content</h3>
            <p>You retain ownership of video footage and other content you upload to the Platform ("User Content"). By uploading User Content, you grant SwingStudio a worldwide, royalty-free, non-exclusive, sublicensable license to use, store, reproduce, process, display, and analyze your User Content solely for the purpose of providing and improving the Platform's services.</p>
            <h3 className="text-sm font-semibold text-foreground">5.2 Content Representations and Warranties</h3>
            <p>By uploading User Content, you represent and warrant that:</p>
            <BulletList items={[
              "You own the content or have all necessary rights, licenses, and consents to upload it",
              "The content does not violate any third-party rights, including privacy or intellectual property rights",
              "You have obtained all necessary consents from individuals depicted in the content, including from parents or guardians for minors",
              "The content does not violate any applicable laws or regulations",
            ]} />
            <p>SwingStudio does not review all User Content prior to upload. You are solely responsible for all User Content you submit.</p>
            <h3 className="text-sm font-semibold text-foreground">5.3 Video Storage</h3>
            <p>SwingStudio stores uploaded video on third-party cloud infrastructure. While we take reasonable precautions, we do not guarantee perpetual storage. We reserve the right to delete content after account termination, extended inactivity, or at our discretion with reasonable notice where practicable.</p>
          </div>
        </Section>

        <Section num="6" title="AI Analysis — No Warranty of Accuracy">
          <p className="font-semibold text-foreground">THE AI-GENERATED SWING ANALYSIS, FEEDBACK, METRICS, AND RECOMMENDATIONS PROVIDED BY SWINGSTUDIO ("ANALYSIS OUTPUT") ARE PROVIDED FOR INFORMATIONAL AND EDUCATIONAL PURPOSES ONLY. SWINGSTUDIO MAKES NO REPRESENTATIONS OR WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, REGARDING THE ACCURACY, COMPLETENESS, RELIABILITY, OR FITNESS FOR ANY PARTICULAR PURPOSE OF ANY ANALYSIS OUTPUT.</p>
          <p>Analysis Output should not be relied upon as the sole basis for training decisions, coaching decisions, or physical activity. SwingStudio is not responsible for any injury, loss of performance, or other harm resulting from reliance on Analysis Output. Users are encouraged to consult qualified coaching and medical professionals for training guidance.</p>
          <p>AI models may produce errors, inaccuracies, or inconsistent results. SwingStudio does not guarantee that Analysis Output will improve athletic performance or achieve any specific result.</p>
        </Section>

        <Section num="7" title="Subscription, Fees, and Refunds">
          <p>SwingStudio offers both free and paid subscription tiers, as well as coach and team licensing options. Paid plans are billed on a recurring basis as disclosed at the time of purchase.</p>
          <BulletList items={[
            "All fees are stated in U.S. dollars and are non-refundable except as expressly provided herein or required by applicable law",
            "SwingStudio reserves the right to change pricing at any time with reasonable advance notice",
            "Failure to pay applicable fees may result in suspension or termination of your account",
            "Coach and team licensing terms are subject to separate written agreements where applicable",
          ]} />
          <p>SwingStudio does not guarantee continuous availability of any paid feature. Downtime or service interruptions do not entitle users to refunds or credits unless expressly stated in a separate written agreement.</p>
        </Section>

        <Section num="8" title="Prohibited Conduct">
          <p>You agree not to:</p>
          <BulletList items={[
            "Use the Platform for any unlawful purpose or in violation of these Terms",
            "Upload content that is defamatory, obscene, harassing, or invasive of another's privacy",
            "Upload content depicting minors without proper parental or guardian consent",
            "Reverse engineer, decompile, or attempt to extract source code from the Platform",
            "Use automated tools, bots, or scrapers to access the Platform",
            "Impersonate any person or entity",
            "Interfere with or disrupt the integrity or performance of the Platform",
            "Attempt to gain unauthorized access to any portion of the Platform or its related systems",
            "Resell or commercially exploit Platform features without express written authorization",
          ]} />
        </Section>

        <Section num="9" title="Intellectual Property">
          <p>All content, technology, trademarks, trade names, software, and other intellectual property comprising the Platform — excluding User Content — are the exclusive property of SwingStudio or its licensors. Nothing in these Terms grants you any right, title, or interest in or to any SwingStudio intellectual property.</p>
          <p>You may not use SwingStudio's name, logo, or branding without prior written consent.</p>
        </Section>

        <Section num="10" title="Disclaimer of Warranties">
          <p className="font-semibold text-foreground">THE PLATFORM AND ALL SERVICES, CONTENT, AND ANALYSIS OUTPUT ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, SWINGSTUDIO EXPRESSLY DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO:</p>
          <BulletList items={[
            "IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE",
            "WARRANTIES THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE",
            "WARRANTIES REGARDING THE ACCURACY OR RELIABILITY OF ANY ANALYSIS OUTPUT",
            "WARRANTIES THAT DEFECTS WILL BE CORRECTED",
          ]} />
          <p>Some jurisdictions do not allow exclusion of implied warranties, so some of the above exclusions may not apply to you.</p>
        </Section>

        <Section num="11" title="Limitation of Liability">
          <p className="font-semibold text-foreground">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SWINGSTUDIO AND ITS OWNER, OFFICERS, AGENTS, AND LICENSORS SHALL NOT BE LIABLE FOR ANY:</p>
          <BulletList items={[
            "INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES",
            "LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITIES",
            "PERSONAL INJURY OR PROPERTY DAMAGE OF ANY NATURE WHATSOEVER",
            "UNAUTHORIZED ACCESS TO OR ALTERATION OF YOUR DATA OR CONTENT",
            "DAMAGES ARISING FROM RELIANCE ON AI-GENERATED ANALYSIS OR FEEDBACK",
          ]} />
          <p className="font-semibold text-foreground">IN NO EVENT SHALL SWINGSTUDIO'S TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR USE OF THE PLATFORM EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO SWINGSTUDIO IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100.00).</p>
          <p>These limitations apply regardless of the theory of liability — whether contract, tort, negligence, strict liability, or otherwise — even if SwingStudio has been advised of the possibility of such damages.</p>
        </Section>

        <Section num="12" title="Indemnification">
          <p>You agree to indemnify, defend, and hold harmless SwingStudio and its owner, affiliates, agents, licensors, and service providers from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, and attorneys' fees arising out of or relating to:</p>
          <BulletList items={[
            "Your use of the Platform",
            "Your User Content",
            "Your violation of these Terms",
            "Your violation of any third-party right, including privacy or intellectual property rights",
            "Any claim that your User Content caused damage to a third party",
            "Any failure to obtain required parental or guardian consent for minor users",
          ]} />
        </Section>

        <Section num="13" title="Third-Party Services">
          <p>The Platform may integrate with or rely upon third-party services, including cloud storage providers, payment processors, and analytics tools. SwingStudio is not responsible for the availability, accuracy, content, products, or services of any third-party service. Your use of third-party services is at your own risk and subject to the applicable third-party terms and privacy policies.</p>
        </Section>

        <Section num="14" title="Privacy and Data">
          <p>Your use of the Platform is subject to our Privacy Policy, which is incorporated by reference into these Terms. By using the Platform, you consent to the collection, use, and sharing of your data as described in the Privacy Policy.</p>
          <p>SwingStudio implements reasonable security measures, but cannot guarantee the absolute security of your data. You acknowledge and agree that you provide data at your own risk, and that SwingStudio shall not be liable for any unauthorized access, disclosure, or breach beyond its reasonable control.</p>
        </Section>

        <Section num="15" title="Termination">
          <p>SwingStudio reserves the right to suspend or terminate your access to the Platform at any time, for any reason or no reason, including for violation of these Terms, with or without prior notice.</p>
          <p>Upon termination, your right to use the Platform immediately ceases. SwingStudio may delete your account and User Content, though some data may be retained as required by law or for legitimate business purposes. Provisions that by their nature should survive termination shall survive, including Sections 6, 10, 11, 12, 16, and 17.</p>
        </Section>

        <Section num="16" title="Dispute Resolution and Arbitration">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">16.1 Informal Resolution</h3>
            <p>Before initiating any legal proceeding, you agree to first contact SwingStudio at the email address below and attempt to resolve the dispute informally for a period of at least thirty (30) days.</p>
            <h3 className="text-sm font-semibold text-foreground">16.2 Binding Arbitration</h3>
            <p>If informal resolution fails, any dispute, claim, or controversy arising out of or relating to these Terms or the Platform shall be resolved by binding individual arbitration under the rules of the American Arbitration Association ("AAA"), and not in a court of law. The arbitration shall take place in Texas. The arbitrator's decision shall be final and binding.</p>
            <h3 className="text-sm font-semibold text-foreground">16.3 Class Action Waiver</h3>
            <p className="font-semibold text-foreground">YOU AND SWINGSTUDIO AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.</p>
            <p>The arbitrator may not consolidate more than one person's claims.</p>
            <h3 className="text-sm font-semibold text-foreground">16.4 Exceptions</h3>
            <p>Either party may seek injunctive or other equitable relief in a court of competent jurisdiction to prevent the actual or threatened infringement, misappropriation, or violation of intellectual property rights.</p>
          </div>
        </Section>

        <Section num="17" title="Governing Law">
          <p>These Terms shall be governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of law provisions. To the extent any dispute is resolved in court notwithstanding the arbitration provision, you consent to the exclusive jurisdiction and venue of the state and federal courts located in Texas.</p>
        </Section>

        <Section num="18" title="Changes to These Terms">
          <p>SwingStudio reserves the right to modify these Terms at any time. When we make material changes, we will update the "Effective Date" at the top of this document and, where reasonably practicable, provide notice via email or in-app notification. Your continued use of the Platform after changes become effective constitutes your acceptance of the revised Terms.</p>
          <p>If you do not agree to the revised Terms, you must stop using the Platform and may close your account.</p>
        </Section>

        <Section num="19" title="Miscellaneous">
          <div className="space-y-2">
            <p><span className="font-semibold text-foreground">Entire Agreement.</span> These Terms, together with the Privacy Policy, constitute the entire agreement between you and SwingStudio with respect to the Platform and supersede all prior agreements.</p>
            <p><span className="font-semibold text-foreground">Severability.</span> If any provision of these Terms is found to be unenforceable, that provision will be modified to the minimum extent necessary to make it enforceable, and the remaining provisions will remain in full force.</p>
            <p><span className="font-semibold text-foreground">No Waiver.</span> SwingStudio's failure to enforce any right or provision shall not constitute a waiver of that right or provision.</p>
            <p><span className="font-semibold text-foreground">Assignment.</span> You may not assign or transfer any rights or obligations under these Terms without prior written consent. SwingStudio may freely assign its rights and obligations.</p>
            <p><span className="font-semibold text-foreground">Force Majeure.</span> SwingStudio shall not be liable for any failure or delay in performance resulting from causes beyond its reasonable control, including acts of God, natural disasters, pandemics, or government actions.</p>
          </div>
        </Section>

        <Section num="20" title="Contact Information">
          <p>For questions, concerns, or notices regarding these Terms, please contact:</p>
          <p className="font-semibold text-foreground">SwingStudio<br />Website: swingstudio.ai</p>
        </Section>

        <div className="border-t border-border pt-8 mt-4 text-xs text-muted-foreground space-y-1">
          <p>© 2026 SwingStudio. All rights reserved.</p>
          <p>This document does not constitute legal advice. Consult a qualified attorney for advice specific to your situation.</p>
        </div>
      </div>
    </Layout>
  );
}
