import React from "react";
import classnames from "classnames";
import { useRouter } from "next/router";
import Link from "next/link";
import { useFriendsPresence } from "./FriendsPresenceProvider";
import { useRoomSession } from "./RoomSessionProvider";

interface IProps {
  name: string;
  label: string;
}

const SidebarItem = ({ name, label }: IProps) => {
  const router = useRouter();
  const { listeningCount, onlineCount } = useFriendsPresence();
  const { room } = useRoomSession();
  const isFriends = name.toLowerCase() === "friends";
  const isRooms = name.toLowerCase() === "rooms";
  const href =
    isRooms && room ? `/rooms/${encodeURIComponent(room.code)}` : `/${name.toLowerCase()}`;
  const hasListeners = isFriends && listeningCount > 0;
  const hasOnlineFriends = isFriends && onlineCount > 0;
  const hasActiveRoom = isRooms && Boolean(room);

  const isActive = () => {
    return isRooms
      ? router.pathname === "/rooms" || router.pathname === "/rooms/[code]"
      : router.pathname === `/${name.toLowerCase()}`;
  };
  const iconName = () => {
    if (!isActive()) {
      return `icon-${name.toLowerCase()} mobile:text-[20px] text-white`;
    } else {
      return `icon-${name.toLowerCase()}-filled mobile:text-[20px]`;
    }
  };
  return (
    <Link href={href}>
      <div
        className="group shrink-0 select-none cursor-pointer mt-4 flex flex-row items-center mobile:flex-col tablet:flex-col
       mini-laptop:w-full mini-laptop:mt-6 mobile:mt-0 tablet:mt-0 mobile:mx-3 tablet:mx-6"
      >
        <span
          className={classnames(
            "relative mr-4 inline-flex mobile:mr-0 tablet:mr-0 mobile:mb-1 tablet:mb-1",
            {
              "friend-nav-live": hasListeners,
              "room-nav-live": hasActiveRoom,
            }
          )}
          title={
            hasActiveRoom
              ? `Listening in ${room?.name}`
              : hasListeners
              ? `${listeningCount} friend${
                  listeningCount > 1 ? "s are" : " is"
                } listening now`
              : hasOnlineFriends
              ? `${onlineCount} friend${
                  onlineCount > 1 ? "s are" : " is"
                } online`
              : undefined
          }
        >
          <i
            className={classnames(iconName(), {
              "opacity-70 group-hover:opacity-100": !isActive(),
              "text-emerald-300 opacity-100": hasListeners,
              "text-violet-300 opacity-100": hasActiveRoom,
            })}
          ></i>
          {hasListeners ? (
            <span className="friend-nav-count" aria-label={`${listeningCount} listening`}>
              {listeningCount > 9 ? "9+" : listeningCount}
            </span>
          ) : hasOnlineFriends ? (
            <span
              className="friend-nav-online-dot"
              aria-label={`${onlineCount} online`}
            />
          ) : hasActiveRoom ? (
            <span
              className="room-nav-equalizer"
              aria-label={`Listening in ${room?.name}`}
            >
              <i />
              <i />
              <i />
            </span>
          ) : null}
        </span>
        <p
          className={classnames(
            "mini-laptop:hidden text-white mobile:text-[10px] tablet:text-[10px] mobile:font-ProximaRegular tablet:font-ProximaRegular",
            {
              "opacity-70 group-hover:opacity-100": !isActive(),
            },
            { "font-ProximaBold": isActive() }
          )}
        >
          {label}
        </p>
      </div>
    </Link>
  );
};

export default SidebarItem;
