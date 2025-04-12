import config from '../../config.cjs';

const userInfo = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix)
    ? m.body.slice(prefix.length).split(' ')[0].toLowerCase()
    : '';

  if (["userinfo", "whois", "profile"].includes(cmd)) {
    await m.React('⏳'); // React with a loading icon

    let mentionedUser = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender;

    try {
      const user = await sock.fetchStatus(mentionedUser);
      const profilePictureUrl = await sock.profilePictureUrl(mentionedUser, 'image').catch(() => 'https://files.catbox.moe/nk71o3.jpg');

      const about = user?.status ? user.status : '🚫 No bio available';
      const userName = user?.name ? user.name : 'Unknown User';

      const responseText = `🔍 *User Info*\n\n`
        + `👤 *Name:* ${userName}\n`
        + `🆔 *User ID:* ${mentionedUser.split('@')[0]}\n`
        + `📜 *Bio:* ${about}\n`
        + `🖼 *Profile Picture:* [Click Here](${profilePictureUrl})\n\n`
        + `_ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴄᴏᴏʟ-ᴋɪᴅ_`;

      await sock.sendMessage(
        m.from,
        {
          text: responseText,
          contextInfo: {
            mentionedJid: [mentionedUser],
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: '120363290715861418@newsletter',
              newsletterName: "🙂ᴄᴏᴏʟ-ᴋɪᴅ xᴍᴅ🙂",
              serverMessageId: -1,
            },
            forwardingScore: 999,
            externalAdReply: {
              title: "👤 User Profile Info",
              body: "User details fetched successfully!",
              thumbnailUrl: profilePictureUrl,
              sourceUrl: 'https://github.com/Popkiddevs/POPKID-XTECH',
              mediaType: 1,
              renderLargerThumbnail: true,
            },
          },
        },
        { quoted: m }
      );

      await m.React('✅'); // React with a success icon
    } catch (error) {
      await m.reply("❌ *Failed to fetch user info!*");
      console.error("User Info Error:", error);
    }
  }
};

export default userInfo;
