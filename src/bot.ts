import {
  Client,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  TextChannel,
  EmbedBuilder,
  Colors,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  APIActionRowComponent,
  APIMessageActionRowComponent,
  Snowflake,
  codeBlock,
} from "discord.js";
import { createPaymentLink, fetchPrice, fetchProduct, getBalance } from "./stripe";
import { ChargeFailed, CheckoutComplete } from ".";

const { BOT_TOKEN, GUILD_ID, ASCEND_PRICE_ID } = process.env;

if (!BOT_TOKEN || !GUILD_ID || !ASCEND_PRICE_ID) process.exit(1);

const client = new Client({
  intents: ["GuildMembers", "Guilds", "DirectMessages"],
});

const commands = [
  new SlashCommandBuilder()
    .setName("purchase")
    .setDescription("Purchase the script using stripe."),
  new SlashCommandBuilder()
    .setName("money")
    .setDescription("Chekc how much we got."),
];

const rest = new REST().setToken(BOT_TOKEN);

client.once(Events.ClientReady, async () => {
  console.log("Bot online!");
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.application?.id || "", GUILD_ID),
      {
        body: commands,
      }
    );
    console.log("Registered!");
  } catch (err) {
    console.log("An error occurred registering commands", err);
    process.exit(1);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;
  const { commandName } = interaction;
  switch (commandName) {
    case "money":
      try {
        await interaction.deferReply();
        const balance = await getBalance();
        const total = (balance.available[0].amount + balance.pending[0].amount) / 100
        interaction.followUp({ content: `There is currently ${total.toLocaleString("en-US", { style: "currency", currency: "NZD"})} in the ascend stripe account.`})
      } catch (err) {
        
      }
    case "purchase":
      try {
        await interaction.deferReply({ ephemeral: true });
        const price = await fetchPrice(ASCEND_PRICE_ID);
        
        if (!price) {
          interaction.followUp({ content: "An error occurred, try again!" });
          return;
        }

        const product = await fetchProduct(price.product.toString());

        if (!product) {
          interaction.followUp({ content: "An error occured, try again!" });
          return;
        }

        const payment = await createPaymentLink(interaction.user.id, [
          {
            price: price.id,
            quantity: 1,
          },
        ]);
        console.log(payment);
        if (!payment) {
          interaction.followUp({ content: "An error occurred, try again." });
          return;
        }
        const purchaseBtn = new ButtonBuilder()
          .setEmoji("💳")
          .setStyle(ButtonStyle.Link)
          .setURL(payment.url as string)
          .setLabel("Checkout");
        const row = new ActionRowBuilder<ButtonBuilder>();
        row.addComponents(purchaseBtn);
        interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setTitle("Purchase")
              .setDescription(
                `I have created a checkout session via STRIPE with the following items:`
              )
              .addFields({
                name: product.name,
                value: `Price: ${price.unit_amount && (price.unit_amount/100).toLocaleString("en-US", {style:"currency", currency:"USD"})}`,
              })
              .setColor(Colors.Blurple),
          ],
          components: [row],
        });
      } catch (err) {
        console.log(err);
        if (interaction.isRepliable()) {
          interaction.reply({ content: "An error occurred" });
        }
      }
      break;
  }
});

export const sendLogBroke = async (checkoutSession: ChargeFailed) => {
  const user = await client.users.fetch(checkoutSession.metadata.discordId);
  if (user) {
    try {
      const channel = (await client.channels.fetch(
        "1127230797154357268"
      )) as TextChannel;
      const embed = new EmbedBuilder()
        .setTitle("Broke boy detected!")
        .setDescription("Here are the details for the declined payment")
        .setImage(
          "https://media.tenor.com/-hf3fNF2ibQAAAAC/brokie-andrew-tate.gif"
        )
        .addFields(
          {
            name: "Decline reason",
            value: codeBlock("Insufficient funds"),
          },
          {
            name: "Discord",
            value: codeBlock(`${user.username} (${user.id})`),
          }
        )
        .setColor(Colors.Red);
      channel.send({
        content: `<@${user.id}> is a broke boy!`,
        embeds: [embed],
      });
    } catch (err) {}
  }
};

export const sendLogComplete = async (
  checkoutSessionCompleted: CheckoutComplete
) => {
  const user = await client.users.fetch(
    checkoutSessionCompleted.metadata.discordId
  );
  const channel = (await client.channels.fetch(
    "1126722789966086154"
  )) as TextChannel;
  if (!user || !channel) return;
  channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("Checkout Complete")
        .addFields([
          {
            name: "User",
            value: codeBlock(`${user.username} (${user.id})`),
          },
          {
            name: "Checkout ID",
            value: codeBlock(checkoutSessionCompleted.id.split("_")[2]),
          },
          {
            name: "Customers Email",
            value: codeBlock(
              (checkoutSessionCompleted.customer_details.email as string) ||
                "Failed to get"
            ),
          },
          {
            name: "Status",
            value: codeBlock("complete"),
            inline: true,
          },
        ])
        .setFooter({
          text: checkoutSessionCompleted.livemode
            ? "This is a real transaction"
            : "This is a test transaction",
        })
        .setTimestamp()
        .setColor(Colors.Blurple),
    ],
  });
};

export const test = () => console.log("test");
client.login(BOT_TOKEN);
