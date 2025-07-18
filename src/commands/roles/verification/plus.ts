// SPDX-License-Identifier: GPL-3.0-or-later
/*
    Animal Rights Advocates Discord Bot
    Copyright (C) 2023  Anthony Berg

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Args, Command, RegisterBehavior } from '@sapphire/framework';
import { Guild, User, Message, MessageFlagsBitField } from 'discord.js';
import IDs from '#utils/ids';
import { roleAddLog, roleRemoveLog } from '#utils/logging/role';
import { getGuildMember, getRole } from '#utils/fetcher';
import { isGuildMember } from '@sapphire/discord.js-utilities';
import { isRole } from '#utils/typeChecking';

export class PlusCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'plus',
      aliases: ['+'],
      description: 'Give/remove the plus role',
      preconditions: [['CoordinatorOnly', 'VerifierOnly', 'ModOnly']],
    });
  }

  // Registers that this is a slash command
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description)
          .addUserOption((option) =>
            option
              .setName('user')
              .setDescription('User to give/remove plus to')
              .setRequired(true),
          ),
      {
        behaviorWhenNotIdentical: RegisterBehavior.Overwrite,
      },
    );
  }

  // Command run
  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    // Get the arguments
    const user = interaction.options.getUser('user', true);
    const mod = interaction.user;
    const { guild } = interaction;

    // Checks if all the variables are of the right type
    if (guild === null) {
      await interaction.reply({
        content: 'Error fetching guild!',
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const info = await this.managePlus(user, mod, guild);

    await interaction.editReply(info.message);
  }

  public async messageRun(message: Message, args: Args) {
    // Get arguments
    let user: User;
    try {
      user = await args.pick('user');
    } catch {
      await message.react('❌');
      await message.reply('User was not provided!');
      return;
    }

    const mod = message.author;

    const { guild } = message;

    if (guild === null) {
      await message.react('❌');
      await message.reply('Guild not found! Try again or contact a developer!');
      return;
    }

    const info = await this.managePlus(user, mod, guild);

    await message.reply(info.message);
    await message.react(info.success ? '✅' : '❌');
  }

  private async managePlus(user: User, mod: User, guild: Guild) {
    const info = {
      message: '',
      success: false,
    };
    const member = await getGuildMember(user.id, guild);
    const plus = await getRole(IDs.roles.vegan.plus, guild);

    // Checks if user's GuildMember was found in cache
    if (!isGuildMember(member)) {
      info.message = 'Error fetching guild member for the user!';
      return info;
    }

    if (!isRole(plus)) {
      info.message = 'Error fetching plus role from cache!';
      return info;
    }

    // Checks if the user has Plus and to give them or remove them based on if they have it
    if (member.roles.cache.has(IDs.roles.vegan.plus)) {
      // Remove the Plus role from the user
      await member.roles.remove(plus);
      await roleRemoveLog(user.id, mod.id, plus);
      info.message = `Removed the ${plus.name} role from ${user}`;
      info.success = true;
      return info;
    }

    // Checks if the user is vegan before giving the plus role
    // If not, stop from giving the plus role
    if (!member.roles.cache.has(IDs.roles.vegan.vegan)) {
      info.message = `Can't give ${user} the vegan role as they are not vegan!`;
      return info;
    }

    // Add Plus role to the user
    await member.roles.add(plus);
    await roleAddLog(user.id, mod.id, plus);
    info.message = `Gave ${user} the ${plus.name} role!`;

    await user
      .send(
        `You have been given the ${plus.name} role by ${mod}! ` +
          'This allows you to access:' +
          `\n- <#${IDs.channels.plus.general}>` +
          `\n- <#${IDs.channels.plus.selfies}>` +
          '\nThis section is still to be kept SFW (so no explicit images). ' +
          'However, you can post or talk about more adult subjects here than ' +
          'in the channels that are not age-restricted.',
      )
      .catch(() => {});
    info.success = true;
    return info;
  }
}
