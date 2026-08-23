import "dotenv/config";
import bcrypt from "bcryptjs";
import { basePrisma as prisma } from "../lib/prisma";
import { CS_AGENT_PREVIEW_AS } from "../lib/auth/cs-agent-scope";

/**
 * Creates the CS agent preview login (default: davidsamii3@gmail.com).
 * That account sees Islam Tharwat's assigned units/cases via CS_AGENT_PREVIEW_AS.
 *
 * Ensure Islam exists first: npm run db:sync-staff
 */
async function main() {
  const previewEmail = (
    process.env.CS_PREVIEW_LOGIN_EMAIL ?? "davidsamii3@gmail.com"
  )
    .trim()
    .toLowerCase();
  const sourceEmail = (
    process.env.CS_PREVIEW_SOURCE_EMAIL ?? "islam.tharwat@newjerseyegypt.com"
  )
    .trim()
    .toLowerCase();
  const password =
    process.env.CS_PREVIEW_PASSWORD ??
    process.env.STAFF_DEFAULT_PASSWORD ??
    "PreviewCs2026!";
  const previewName =
    process.env.CS_PREVIEW_NAME?.trim() ?? "Islam Tharwat (Preview)";

  if (password.length < 12) {
    console.error("CS_PREVIEW_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }

  const source = await prisma.user.findUnique({ where: { email: sourceEmail } });
  if (!source) {
    console.error(
      `Source agent not found: ${sourceEmail}. Run: npm run db:sync-staff`
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email: previewEmail },
    update: {
      name: previewName,
      password: passwordHash,
      role: "CS_AGENT",
      is2FAEnabled: false,
      twoFactorSecret: null,
      requiresPasswordChange: false,
    },
    create: {
      name: previewName,
      email: previewEmail,
      password: passwordHash,
      role: "CS_AGENT",
      is2FAEnabled: false,
      requiresPasswordChange: false,
    },
  });

  const [unitCount, ticketCount] = await Promise.all([
    prisma.unit.count({ where: { agentId: source.id } }),
    prisma.ticket.count({
      where: {
        OR: [{ agentId: source.id }, { unit: { agentId: source.id } }],
      },
    }),
  ]);

  console.log("CS preview account ready.");
  console.log(`  Login email:    ${previewEmail}`);
  console.log(`  Password:       ${password}`);
  console.log(`  Preview as:     ${source.name} (${sourceEmail})`);
  console.log(`  Mapped via:     CS_AGENT_PREVIEW_AS`);
  console.log(`  Source units:   ${unitCount}`);
  console.log(`  Visible cases:  ${ticketCount}`);
  console.log(
    `\nConfigured mapping:`,
    JSON.stringify(CS_AGENT_PREVIEW_AS, null, 2)
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
