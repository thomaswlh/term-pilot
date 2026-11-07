"use client";

import { UserButton } from "@clerk/nextjs";
import { UserRoundIcon } from "lucide-react";

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
      </UserButton.MenuItems>
    </UserButton>
  );
}
