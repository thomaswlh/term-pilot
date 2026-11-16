"use client";

import { UserButton } from "@clerk/nextjs";
import { MessageSquareTextIcon, UserRoundIcon } from "lucide-react";

export function AccountMenu() {
  return (
    <UserButton
      appearance={{
        elements: {
          avatarBox: {
            width: 36,
            height: 36,
          },
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link label="Profile" labelIcon={<UserRoundIcon aria-hidden size={16} />} href="/profile" />
        <UserButton.Link
          label="Connect 選咩課"
          labelIcon={<MessageSquareTextIcon aria-hidden size={16} />}
          href="/what2reg"
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}
