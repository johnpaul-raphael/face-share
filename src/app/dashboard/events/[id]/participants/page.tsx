import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { events, users } from '@/lib/data';

export default function ParticipantsPage({
  params,
}: {
  params: { id: string };
}) {
  const event = events.find((e) => e.id === params.id);
  const participants =
    event?.participantIds.map((id) => users.find((u) => u.id === id)) || [];

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Avatar</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {participants.map(
            (user) =>
              user && (
                <TableRow key={user.id}>
                  <TableCell>
                    <Avatar>
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {event?.ownerId === user.id ? (
                      <Badge variant="default">Owner</Badge>
                    ) : (
                      <Badge variant="outline">Participant</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
          )}
        </TableBody>
      </Table>
    </div>
  );
}
